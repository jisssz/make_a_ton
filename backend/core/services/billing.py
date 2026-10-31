"""
Recurring billing engine, invoices and payments.

Guarantees:
  * never twice  — UNIQUE(subscription, period_start) in the database; a rerun creates nothing
  * never skipped — a catch-up loop bills every period up to the billing date
  * atomic        — invoice + lines + discount usage + next_billing_date change in one transaction
"""
import time
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from ..errors import AppError, Forbidden, NotFound, check_fields
from ..models import AuditEvent, BillingRun, Discount, Invoice, InvoiceLine, Payment, Sequence, Subscription
from .dates import next_period_start, parse, today
from .pricing import price_subscription

MAX_PERIODS_PER_RUN = 800  # guard for daily plans that were left unbilled for years


def audit(entity, entity_id, action, detail='', actor=None):
    AuditEvent.objects.create(entity=entity, entity_id=entity_id or 0, action=action, detail=detail[:255], actor=getattr(actor, 'name', actor) or 'System')


def require_staff(actor):
    if not actor or actor.role not in ('ADMIN', 'STAFF'):
        raise Forbidden()


def next_number(code):
    """Gap-free sequence, safe inside a transaction."""
    seq, _ = Sequence.objects.select_for_update().get_or_create(code=code)
    value = seq.next_value
    Sequence.objects.filter(code=code).update(next_value=F('next_value') + 1)
    return value


def hard_end(sub):
    ends = [d for d in (sub.expiry_date, sub.plan.end_date) if d]
    return min(ends) if ends else None


def is_due(sub, on=None):
    on = on or today()
    if sub.state != Subscription.ACTIVE or not sub.next_billing_date or sub.next_billing_date > on:
        return False
    end = hard_end(sub)
    return not end or sub.next_billing_date <= end


def _create_invoice(sub, start, end, lines, discounts):
    priced = price_subscription(sub, start, lines=lines, discounts=discounts)
    inv = Invoice.objects.create(
        subscription=sub, customer_id=sub.customer_id, period_start=start, period_end=end, invoice_date=start,
        due_date=start + timedelta(days=sub.payment_terms_days), subtotal=priced['subtotal'],
        discount_total=priced['discountTotal'], tax_total=priced['taxTotal'], total=priced['total'],
        discount=priced['discount'], discount_name=priced['discountName'] or '',
    )
    InvoiceLine.objects.bulk_create([InvoiceLine(
        invoice=inv, kind=l['kind'], product_id=l['productId'], description=l['description'], qty=l['qty'],
        unit_price=l['unitPrice'], base=l['base'], discount=l['discount'], taxable=l['taxable'], tax_rate=l['taxRate'],
        tax_name=l['taxName'], tax=l['tax'], cgst=l['cgst'], sgst=l['sgst'], igst=l['igst'], total=l['total'],
    ) for l in priced['lines']])
    if priced['discount']:
        Discount.objects.filter(pk=priced['discount'].pk).update(times_used=F('times_used') + 1)
        priced['discount'].times_used += 1  # keep the in-memory copy in step for this run
    return inv


def bill_subscription(sub, up_to, discounts=None):
    """Create every missing invoice for one subscription up to `up_to`. Returns (created, skipped)."""
    created = skipped = guard = 0
    end_limit = hard_end(sub)
    lines = list(sub.lines.select_related('product', 'variant', 'tax'))
    discounts = list(Discount.objects.filter(active=True)) if discounts is None else discounts
    while sub.next_billing_date and sub.next_billing_date <= up_to and guard < MAX_PERIODS_PER_RUN:
        guard += 1
        if end_limit and sub.next_billing_date > end_limit:
            break
        start = sub.next_billing_date
        nxt = next_period_start(start, sub.plan.period, sub.anchor_day)
        try:
            with transaction.atomic():
                _create_invoice(sub, start, nxt - timedelta(days=1), lines, discounts)
                Subscription.objects.filter(pk=sub.pk).update(next_billing_date=nxt)
            created += 1
        except IntegrityError:  # already billed for this period (rerun or a parallel worker)
            Subscription.objects.filter(pk=sub.pk).update(next_billing_date=nxt)
            skipped += 1
        sub.next_billing_date = nxt
    return created, skipped


def run_billing(actor=None, up_to=None):
    if actor is not None:
        require_staff(actor)
    t0 = time.perf_counter()
    run_date = parse(up_to) or today()
    created = skipped = closed = billed = 0
    discounts = list(Discount.objects.filter(active=True))
    due = (Subscription.objects.select_related('plan', 'plan__tax', 'customer')
           .filter(state=Subscription.ACTIVE).order_by('next_billing_date', 'id'))
    for sub in due.iterator(chunk_size=200):
        c, s = bill_subscription(sub, run_date, discounts)
        created, skipped, billed = created + c, skipped + s, billed + (1 if c else 0)
        end = hard_end(sub)
        if sub.plan.auto_close and end and end < run_date:
            Subscription.objects.filter(pk=sub.pk).update(state=Subscription.CLOSED, closed_on=run_date, close_reason='Auto-closed: plan period ended')
            audit('subscription', sub.id, 'Auto-closed', 'Plan period ended', 'Billing run')
            closed += 1
    run = BillingRun.objects.create(
        run_date=run_date, created=created, skipped=skipped, closed=closed, subs_billed=billed,
        duration_ms=int((time.perf_counter() - t0) * 1000), by=getattr(actor, 'name', None) or 'Scheduler',
    )
    audit('billing', run.id, 'Billing run', f'{created} invoices created, {skipped} duplicates skipped', run.by)
    return run


# ---------------------------------------------------------------- invoices
def confirm_invoices(ids, actor):
    require_staff(actor)
    n = 0
    with transaction.atomic():
        for inv in Invoice.objects.select_for_update().filter(pk__in=ids, state=Invoice.DRAFT).order_by('invoice_date', 'id'):
            year = inv.invoice_date.year
            inv.number = f'INV/{year}/{next_number(f"INV{year}"):05d}'
            inv.state = Invoice.CONFIRMED
            inv.save(update_fields=['number', 'state'])
            n += 1
    if n:
        audit('invoice', 0, 'Invoices confirmed', f'{n} invoice(s)', actor)
    return n


def cancel_invoice(invoice_id, actor):
    require_staff(actor)
    with transaction.atomic():
        inv = Invoice.objects.select_for_update().filter(pk=invoice_id).first()
        if not inv:
            raise NotFound('Invoice')
        if inv.amount_paid > 0:
            raise AppError('An invoice with payments cannot be cancelled')
        if inv.state not in (Invoice.DRAFT, Invoice.CONFIRMED):
            raise AppError('This invoice cannot be cancelled')
        inv.state = Invoice.CANCELLED
        inv.save(update_fields=['state'])
        if inv.discount_id:  # release the discount usage it counted
            Discount.objects.filter(pk=inv.discount_id, times_used__gt=0).update(times_used=F('times_used') - 1)
    audit('invoice', inv.id, 'Cancelled', inv.number or f'Draft #{inv.id}', actor)


def send_invoice(invoice_id, actor):
    require_staff(actor)
    inv = Invoice.objects.select_related('customer').filter(pk=invoice_id).first()
    if not inv:
        raise NotFound('Invoice')
    if inv.state == Invoice.DRAFT:
        confirm_invoices([inv.id], actor)
    Invoice.objects.filter(pk=inv.pk).update(sent_at=timezone.now())
    # Hook a real email provider here; the PDF comes from the print view.
    audit('invoice', inv.id, 'Sent', f'Emailed to {inv.customer.email}', actor)
    return inv.customer.email


# ---------------------------------------------------------------- payments
def record_payment(data, actor):
    require_staff(actor)
    fields = {}
    try:
        amount = int(data.get('amount') or 0)
    except (TypeError, ValueError):
        amount = 0
    method = data.get('method')
    paid_on = parse(data.get('paidOn'))
    with transaction.atomic():
        inv = Invoice.objects.select_for_update().filter(pk=data.get('invoiceId')).first()
        if not inv:
            raise NotFound('Invoice')
        if inv.state not in (Invoice.CONFIRMED, Invoice.PARTIAL):
            raise AppError('Payments can only be recorded on confirmed invoices')
        if amount <= 0:
            fields['amount'] = 'Amount must be more than 0'
        elif amount > inv.balance:
            fields['amount'] = 'Amount is more than the balance due'
        if method not in dict(Payment.METHODS):
            fields['method'] = 'Choose a payment method'
        if not paid_on:
            fields['paidOn'] = 'Payment date is required'
        elif paid_on > today():
            fields['paidOn'] = 'Payment date cannot be in the future'
        check_fields(fields)
        pay = Payment.objects.create(invoice=inv, customer_id=inv.customer_id, method=method, amount=amount, paid_on=paid_on,
                                     note=(data.get('note') or '')[:255], recorded_by=actor.name)
        inv.amount_paid += amount
        inv.state = Invoice.PAID if inv.balance == 0 else Invoice.PARTIAL
        inv.save(update_fields=['amount_paid', 'state'])
    audit('invoice', inv.id, 'Payment recorded', f'{method} ₹{amount / 100:,.2f}', actor)
    return pay
