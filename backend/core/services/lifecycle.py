"""Subscription lifecycle: Draft -> Quotation -> Confirmed -> Active (-> Paused) -> Closed."""
from datetime import timedelta

from django.db import transaction

from ..errors import AppError, Forbidden, NotFound, check_fields
from ..models import (Customer, Product, ProductVariant, QuotationTemplate, RecurringPlan, Subscription,
                      SubscriptionLine, Tax)
from .billing import audit, next_number, require_staff
from .dates import add_months_anchored, iso, parse, today

TRANSITIONS = {
    'send': (['DRAFT'], 'QUOTATION', 'Quotation sent'),
    'confirm': (['QUOTATION'], 'CONFIRMED', 'Confirmed'),
    'activate': (['CONFIRMED'], 'ACTIVE', 'Activated'),
    'pause': (['ACTIVE'], 'PAUSED', 'Paused'),
    'resume': (['PAUSED'], 'ACTIVE', 'Resumed'),
    'close': (['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED'], 'CLOSED', 'Closed'),
    'renew': (['ACTIVE', 'PAUSED'], None, 'Renewed'),
}


def allowed_actions(sub, role):
    plan = sub.plan
    out = []
    for action, (frm, _, _) in TRANSITIONS.items():
        if sub.state not in frm:
            continue
        if action in ('pause', 'resume') and not plan.pausable:
            continue
        if action == 'renew' and not plan.renewable:
            continue
        if role == 'CUSTOMER':
            # Customers may only do what the plan allows them to self-serve
            if action == 'close' and not (plan.closable and sub.state in ('ACTIVE', 'PAUSED')):
                continue
            if action not in ('close', 'pause', 'resume', 'renew'):
                continue
        out.append(action)
    return out


def get_for_actor(sub_id, actor):
    sub = Subscription.objects.select_related('plan', 'plan__tax', 'customer', 'template').filter(pk=sub_id).first()
    if not sub or (actor.role == 'CUSTOMER' and sub.customer_id != actor.customer_id):
        raise NotFound('Subscription')  # customers never learn other customers' records exist
    return sub


def _validate(data):
    fields = {}
    customer = Customer.objects.filter(pk=data.get('customerId') or 0).first()
    plan = RecurringPlan.objects.filter(pk=data.get('planId') or 0).first()
    start, expiry = parse(data.get('startDate')), parse(data.get('expiryDate'))
    try:
        qty = int(data.get('qty') or 0)
    except (TypeError, ValueError):
        qty = 0
    if not customer:
        fields['customerId'] = 'Choose a customer'
    if not plan:
        fields['planId'] = 'Choose a plan'
    if not start:
        fields['startDate'] = 'Start date is required'
    if expiry and start and expiry <= start:
        fields['expiryDate'] = 'Expiry must be after the start date'
    if plan:
        if qty < plan.min_qty:
            fields['qty'] = f'This plan needs at least {plan.min_qty}'
        if start and plan.start_date and start < plan.start_date:
            fields['startDate'] = f'Plan is available from {plan.start_date}'
        if start and plan.end_date and start > plan.end_date:
            fields['startDate'] = f'Plan ended on {plan.end_date}'
    lines = []
    for i, l in enumerate(data.get('lines') or []):
        product = Product.objects.filter(pk=l.get('productId') or 0).first()
        try:
            lqty, price = int(l.get('qty') or 0), int(l.get('unitPrice'))
        except (TypeError, ValueError):
            lqty, price = 0, -1
        if not product:
            fields[f'line{i}'] = 'Choose a product'
        elif lqty <= 0:
            fields[f'line{i}'] = 'Quantity must be more than 0'
        elif price < 0:
            fields[f'line{i}'] = 'Price cannot be negative'
        else:
            lines.append({'product': product, 'variant': ProductVariant.objects.filter(pk=l.get('variantId') or 0, product=product).first(),
                          'qty': lqty, 'unit_price': price, 'tax': Tax.objects.filter(pk=l.get('taxId') or 0).first()})
    check_fields(fields)
    return customer, plan, start, expiry, qty, lines


@transaction.atomic
def save_subscription(data, actor):
    require_staff(actor)
    customer, plan, start, expiry, qty, lines = _validate(data)
    values = dict(customer=customer, plan=plan, qty=qty, start_date=start, expiry_date=expiry, anchor_day=start.day,
                  payment_terms_days=int(data.get('paymentTermsDays') or 0),
                  template=QuotationTemplate.objects.filter(pk=data.get('templateId') or 0).first())
    if data.get('id'):
        sub = Subscription.objects.select_for_update().filter(pk=data['id']).first()
        if not sub:
            raise NotFound('Subscription')
        if sub.state not in ('DRAFT', 'QUOTATION'):
            raise AppError('Only Draft or Quotation subscriptions can be edited')
        for k, v in values.items():
            setattr(sub, k, v)
        sub.save()
        sub.lines.all().delete()
        action = 'Edited'
    else:
        sub = Subscription.objects.create(number=f'SUB-{next_number("SUB"):05d}', state='DRAFT', **values)
        action = 'Created as Draft'
    SubscriptionLine.objects.bulk_create([SubscriptionLine(subscription=sub, **l) for l in lines])
    audit('subscription', sub.id, action, sub.number, actor)
    return sub


def draft_from_template(template_id):
    t = QuotationTemplate.objects.select_related('plan').filter(pk=template_id).first()
    if not t:
        raise NotFound('Template')
    start = today()
    return {
        'templateId': t.id, 'planId': t.plan_id, 'qty': max(t.qty, t.plan.min_qty), 'startDate': iso(start),
        'expiryDate': iso(add_months_anchored(start, t.duration_months, start.day)) if t.duration_months else '',
        'paymentTermsDays': t.payment_terms_days, 'validityDays': t.validity_days,
        'lines': [{
            'productId': l.product_id, 'variantId': l.variant_id or '', 'qty': l.qty,
            'unitPrice': l.product.sales_price + (l.variant.extra_price if l.variant else 0), 'taxId': l.product.tax_id or '',
        } for l in t.lines.select_related('product', 'variant')],
    }


@transaction.atomic
def transition(sub_id, action, actor):
    sub = get_for_actor(sub_id, actor)
    sub = Subscription.objects.select_for_update().select_related('plan', 'template').get(pk=sub.pk)
    if action not in allowed_actions(sub, actor.role):
        raise AppError(f'Cannot {action} a {sub.state.lower()} subscription')
    _, to_state, label = TRANSITIONS[action]
    d, detail = today(), ''
    if action == 'send':
        sub.valid_until = d + timedelta(days=sub.template.validity_days if sub.template else 15)
        detail = f'Valid until {sub.valid_until}'
    elif action == 'confirm':
        if sub.valid_until and sub.valid_until < d:
            raise AppError('This quotation has expired. Send a new one.')
    elif action == 'activate':
        sub.next_billing_date = sub.start_date  # first period bills on the start date (catch-up if in the past)
        sub.activated_on = d
        detail = f'Billing from {sub.start_date}'
    elif action == 'pause':
        sub.paused_on = d
    elif action == 'resume':
        paused = max(0, (d - sub.paused_on).days) if sub.paused_on else 0
        if sub.next_billing_date:  # paused time is not billed
            sub.next_billing_date += timedelta(days=paused)
        if sub.expiry_date:
            sub.expiry_date += timedelta(days=paused)
        sub.paused_on = None
        detail = f'Paused {paused} day(s); next bill {sub.next_billing_date}'
    elif action == 'close':
        sub.closed_on = d
        sub.close_reason = 'Closed by customer' if actor.role == 'CUSTOMER' else 'Closed by staff'
    elif action == 'renew':
        base = sub.expiry_date if sub.expiry_date and sub.expiry_date > d else d
        sub.expiry_date = add_months_anchored(base, 12 if sub.plan.period in ('MONTHLY', 'YEARLY') else 3, base.day)
        detail = f'New expiry {sub.expiry_date}'
    if to_state:
        sub.state = to_state
    sub.save()
    audit('subscription', sub.id, label, detail, actor)
    return sub


def ensure_role(actor, *roles):
    if actor.role not in roles:
        raise Forbidden()
