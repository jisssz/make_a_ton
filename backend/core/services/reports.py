"""Finance dashboard, Billing Control Centre and rule-based revenue-leakage checks.

Uses a handful of aggregate queries (no per-row ORM loops) so pages stay well under 2 s
with thousands of subscriptions.
"""
import calendar
import time
from datetime import date, timedelta

from django.db.models import Count, F, Q, Sum

from ..models import AuditEvent, Discount, Invoice, Payment, RecurringPlan, Subscription, SubscriptionLine
from . import serializers as S
from .billing import hard_end
from .dates import MONTHLY_FACTOR, add_months_anchored, today

OPEN = (Invoice.CONFIRMED, Invoice.PARTIAL)
BILLED = (Invoice.CONFIRMED, Invoice.PARTIAL, Invoice.PAID)


def mrr_map(subs):
    """{subscription_id: monthly recurring value} for the given rows (dicts with id, qty, plan__price, plan__period)."""
    ids = [s['id'] for s in subs]
    extra = {}
    for i in range(0, len(ids), 1000):  # batched: databases cap the size of IN (...) lists
        extra.update(SubscriptionLine.objects.filter(subscription_id__in=ids[i:i + 1000]).values('subscription_id')
                     .annotate(v=Sum(F('unit_price') * F('qty'))).values_list('subscription_id', 'v'))
    return {s['id']: round((s['plan__price'] * s['qty'] + (extra.get(s['id']) or 0)) * MONTHLY_FACTOR[s['plan__period']]) for s in subs}


def rows_of(subs):
    """Subscription objects (with plan loaded) -> rows for mrr_map, without an extra IN (...) query."""
    return [{'id': s.id, 'qty': s.qty, 'customer_id': s.customer_id, 'plan__price': s.plan.price, 'plan__period': s.plan.period} for s in subs]


SUB_FIELDS = ('id', 'state', 'qty', 'plan_id', 'customer_id', 'plan__price', 'plan__period', 'activated_on', 'closed_on', 'paused_on')


def summary(date_from=None, date_to=None, plan_id=None):
    t0 = time.perf_counter()
    on = today()
    subs = Subscription.objects.all()
    inv = Invoice.objects.all()
    pay = Payment.objects.all()
    if plan_id:
        subs, inv, pay = subs.filter(plan_id=plan_id), inv.filter(subscription__plan_id=plan_id), pay.filter(invoice__subscription__plan_id=plan_id)
    active = list(subs.filter(state=Subscription.ACTIVE).values(*SUB_FIELDS))
    mrr = sum(mrr_map(active).values())
    customers = len({s['customer_id'] for s in active})
    billed_qs = inv.filter(state__in=BILLED)
    if date_from:
        billed_qs, pay = billed_qs.filter(invoice_date__gte=date_from), pay.filter(paid_on__gte=date_from)
    if date_to:
        billed_qs, pay = billed_qs.filter(invoice_date__lte=date_to), pay.filter(paid_on__lte=date_to)
    billed = billed_qs.aggregate(v=Sum('total'))['v'] or 0
    collected = pay.aggregate(v=Sum('amount'))['v'] or 0
    open_inv = inv.filter(state__in=OPEN)
    outstanding = open_inv.aggregate(v=Sum(F('total') - F('amount_paid')))['v'] or 0
    od = open_inv.filter(due_date__lt=on).exclude(total=F('amount_paid')).aggregate(v=Sum(F('total') - F('amount_paid')), n=Count('id'))
    counts = dict(subs.values_list('state').annotate(n=Count('id')))
    return {
        'activeSubs': len(active), 'pausedSubs': counts.get('PAUSED', 0), 'totalSubs': sum(counts.values()),
        'mrr': mrr, 'arr': mrr * 12, 'arpu': round(mrr / customers) if customers else 0,
        'billed': billed, 'collected': collected, 'outstanding': outstanding, 'overdue': od['v'] or 0, 'overdueCount': od['n'],
        'drafts': inv.filter(state=Invoice.DRAFT).count(), 'collectionRate': (collected / billed * 100) if billed else 0,
        'ms': int((time.perf_counter() - t0) * 1000),
    }


def trends(months=12):
    on = today()
    first = date(on.year, on.month, 1)
    keys = [add_months_anchored(first, -i, 1) for i in range(months - 1, -1, -1)]
    start = keys[0]
    billed = {f'{y}-{m:02d}': v for y, m, v in Invoice.objects.filter(state__in=BILLED, invoice_date__gte=start)
              .values_list('invoice_date__year', 'invoice_date__month').annotate(v=Sum('total'))}
    collected = {f'{y}-{m:02d}': v for y, m, v in Payment.objects.filter(paid_on__gte=start)
                 .values_list('paid_on__year', 'paid_on__month').annotate(v=Sum('amount'))}
    subs = list(Subscription.objects.filter(activated_on__isnull=False).values(*SUB_FIELDS))
    mrr = mrr_map(subs)
    out = []
    for k in keys:
        end = date(k.year, k.month, calendar.monthrange(k.year, k.month)[1])
        key = f'{k.year}-{k.month:02d}'
        value = 0
        for s in subs:
            if s['activated_on'] > end or (s['closed_on'] and s['closed_on'] <= end):
                continue
            if s['state'] == 'PAUSED' and s['paused_on'] and s['paused_on'] <= end:
                continue
            if s['state'] in ('ACTIVE', 'PAUSED', 'CLOSED'):
                value += mrr[s['id']]
        out.append({'key': key, 'mrr': value, 'billed': billed.get(key, 0), 'collected': collected.get(key, 0)})
    return out


def aging():
    on = today()
    b = {'current': 0, 'd30': 0, 'd60': 0, 'd90': 0, 'd90p': 0}
    for due, bal in Invoice.objects.filter(state__in=OPEN).exclude(total=F('amount_paid')).values_list('due_date').annotate(bal=Sum(F('total') - F('amount_paid'))):
        late = (on - due).days
        key = 'current' if late <= 0 else 'd30' if late <= 30 else 'd60' if late <= 60 else 'd90' if late <= 90 else 'd90p'
        b[key] += bal
    return b


def _sub_rows(qs):
    qs = list(qs.select_related('customer', 'plan').prefetch_related('lines'))
    return [S.subscription(s) for s in qs]


def due_subscriptions(on=None):
    on = on or today()
    qs = Subscription.objects.select_related('plan').filter(state=Subscription.ACTIVE, next_billing_date__lte=on)
    return [s for s in qs if not hard_end(s) or s.next_billing_date <= hard_end(s)]


def control_centre():
    on = today()
    in30, in7 = on + timedelta(days=30), on + timedelta(days=7)
    renewals = Subscription.objects.filter(state__in=['ACTIVE', 'PAUSED'], plan__renewable=True, expiry_date__gte=on, expiry_date__lte=in30).order_by('expiry_date')
    quotes = Subscription.objects.filter(state=Subscription.QUOTATION, valid_until__lte=in7).order_by('valid_until')
    drafts = Invoice.objects.filter(state=Invoice.DRAFT).aggregate(n=Count('id'), v=Sum('total'))
    overdue = Invoice.objects.filter(state__in=OPEN, due_date__lt=on).exclude(total=F('amount_paid'))
    due = due_subscriptions(on)
    due_values = mrr_map(rows_of(due))
    discounts = [S.discount(d) for d in Discount.objects.filter(active=True) if
                 (in30 >= d.end_date >= on) or (d.usage_limit and d.usage_limit - d.times_used <= max(5, d.usage_limit * 0.1))]
    return {
        'renewals': _sub_rows(renewals[:6]), 'renewalsCount': renewals.count(),
        'dueToday': len(due), 'dueValue': sum(due_values.values()),
        'expiringQuotes': _sub_rows(quotes),
        'drafts': drafts['n'], 'draftValue': drafts['v'] or 0,
        'overdue': [S.invoice(i, on=on) for i in overdue.select_related('customer', 'subscription').order_by('due_date')[:6]],
        'overdueCount': overdue.count(), 'discounts': discounts,
    }


def leakage():
    on = today()
    missed = [s for s in due_subscriptions(on) if s.next_billing_date < on]
    missed_value = sum(mrr_map(rows_of(missed)).values())
    active = list(Subscription.objects.filter(state=Subscription.ACTIVE).values(*SUB_FIELDS))
    zero = sum(1 for v in mrr_map(active).values() if v == 0)
    duplicates = (Invoice.objects.exclude(state=Invoice.CANCELLED).values('subscription_id', 'period_start')
                  .annotate(n=Count('id')).filter(n__gt=1).count())  # stays 0 thanks to the unique constraint
    expired = Discount.objects.filter(active=True, end_date__lt=on).count()
    old = Invoice.objects.filter(state__in=OPEN, due_date__lt=on - timedelta(days=60)).exclude(total=F('amount_paid'))
    old_v = old.aggregate(v=Sum(F('total') - F('amount_paid')))['v'] or 0
    items = [
        {'key': 'missed', 'label': 'Active subscriptions with missed billing', 'count': len(missed), 'value': missed_value, 'fix': 'Run billing', 'to': '/app/billing'},
        {'key': 'dup', 'label': 'Duplicate invoices for the same period', 'count': duplicates, 'value': 0, 'fix': 'Protected by unique period rule', 'to': None},
        {'key': 'zero', 'label': 'Active subscriptions billing ₹0', 'count': zero, 'value': 0, 'fix': 'Review lines', 'to': '/app/subscriptions?state=ACTIVE'},
        {'key': 'expdisc', 'label': 'Expired discounts still switched on', 'count': expired, 'value': 0, 'fix': 'Turn off', 'to': '/app/catalog?tab=discounts'},
        {'key': 'old', 'label': 'Invoices overdue for more than 60 days', 'count': old.count(), 'value': old_v, 'fix': 'Chase payment', 'to': '/app/invoices?filter=overdue'},
    ]
    return {'items': items, 'atRisk': missed_value + old_v}


def dashboard(date_from=None, date_to=None, plan_id=None):
    t0 = time.perf_counter()
    out = {
        'summary': summary(date_from, date_to, plan_id), 'trends': trends(12), 'aging': aging(), 'leakage': leakage(),
        'control': control_centre(), 'activity': [S.event(e) for e in AuditEvent.objects.all()[:8]],
        'planMix': [{'name': p.name, 'count': p.n} for p in RecurringPlan.objects.annotate(n=Count('subscription', filter=Q(subscription__state='ACTIVE')))],
    }
    out['ms'] = int((time.perf_counter() - t0) * 1000)
    return out
