"""
Model -> JSON dicts in the exact shape the React app expects (camelCase, paise ints, ISO dates).
Plain functions keep the shapes obvious and fast for large lists.
"""
from .dates import iso, today

num = lambda d: float(d) if d is not None and d % 1 else int(d or 0)  # noqa: E731
ms = lambda dt: int(dt.timestamp() * 1000) if dt else None  # noqa: E731


def user(u):
    return {'id': u.id, 'name': u.name, 'email': u.email, 'role': u.role, 'customerId': u.customer_id, 'active': u.is_active}


def customer(c):
    return {'id': c.id, 'name': c.name, 'contact': c.contact, 'email': c.email, 'phone': c.phone, 'city': c.city,
            'state': c.state, 'gstin': c.gstin, 'createdAt': iso(c.created_at)}


def tax(t):
    return {'id': t.id, 'name': t.name, 'rate': num(t.rate), 'type': t.type, 'active': t.active}


def product(p):
    return {'id': p.id, 'name': p.name, 'type': p.type, 'salesPrice': p.sales_price, 'costPrice': p.cost_price,
            'notes': p.notes, 'taxId': p.tax_id, 'active': p.active}


def variant(v):
    return {'id': v.id, 'productId': v.product_id, 'attribute': v.attribute, 'value': v.value, 'extraPrice': v.extra_price}


def plan(p):
    return {'id': p.id, 'name': p.name, 'period': p.period, 'price': p.price, 'minQty': p.min_qty,
            'startDate': iso(p.start_date), 'endDate': iso(p.end_date), 'taxId': p.tax_id, 'autoClose': p.auto_close,
            'closable': p.closable, 'pausable': p.pausable, 'renewable': p.renewable, 'active': p.active}


def discount(d):
    return {'id': d.id, 'name': d.name, 'kind': d.kind, 'value': num(d.value), 'minAmount': d.min_amount, 'minQty': d.min_qty,
            'startDate': iso(d.start_date), 'endDate': iso(d.end_date), 'usageLimit': d.usage_limit, 'timesUsed': d.times_used,
            'scope': d.scope, 'productId': d.product_id, 'active': d.active}


def template(t):
    return {'id': t.id, 'name': t.name, 'planId': t.plan_id, 'qty': t.qty, 'validityDays': t.validity_days,
            'paymentTermsDays': t.payment_terms_days, 'durationMonths': t.duration_months, 'notes': t.notes,
            'lines': [{'productId': l.product_id, 'variantId': l.variant_id, 'qty': l.qty} for l in t.lines.all()]}


def sub_line(l):
    return {'id': l.id, 'productId': l.product_id, 'variantId': l.variant_id, 'qty': l.qty, 'unitPrice': l.unit_price, 'taxId': l.tax_id}


def subscription(s, mrr=None, lines=None):
    from .pricing import sub_mrr
    lines = list(s.lines.all()) if lines is None else lines
    return {
        'id': s.id, 'number': s.number, 'customerId': s.customer_id, 'customer': s.customer.name,
        'planId': s.plan_id, 'plan': s.plan.name, 'period': s.plan.period, 'qty': s.qty, 'state': s.state,
        'startDate': iso(s.start_date), 'expiryDate': iso(s.expiry_date), 'nextBillingDate': iso(s.next_billing_date),
        'anchorDay': s.anchor_day, 'paymentTermsDays': s.payment_terms_days, 'validUntil': iso(s.valid_until),
        'templateId': s.template_id, 'activatedOn': iso(s.activated_on), 'pausedOn': iso(s.paused_on),
        'closedOn': iso(s.closed_on), 'closeReason': s.close_reason, 'createdAt': iso(s.created_at),
        'lines': [sub_line(l) for l in lines], 'mrr': sub_mrr(s, lines) if mrr is None else mrr,
    }


def invoice_line(l):
    return {'kind': l.kind, 'productId': l.product_id, 'description': l.description, 'qty': l.qty, 'unitPrice': l.unit_price,
            'base': l.base, 'discount': l.discount, 'taxable': l.taxable, 'taxRate': num(l.tax_rate), 'taxName': l.tax_name,
            'tax': l.tax, 'cgst': l.cgst, 'sgst': l.sgst, 'igst': l.igst, 'total': l.total}


def invoice(i, with_lines=False, on=None):
    on = on or today()
    balance = i.total - i.amount_paid
    overdue = i.state in ('CONFIRMED', 'PARTIAL') and balance > 0 and i.due_date < on
    out = {
        'id': i.id, 'number': i.number, 'subscriptionId': i.subscription_id, 'subscriptionNumber': i.subscription.number,
        'customerId': i.customer_id, 'customer': i.customer.name, 'periodStart': iso(i.period_start), 'periodEnd': iso(i.period_end),
        'invoiceDate': iso(i.invoice_date), 'dueDate': iso(i.due_date), 'state': i.state, 'subtotal': i.subtotal,
        'discountTotal': i.discount_total, 'taxTotal': i.tax_total, 'total': i.total, 'amountPaid': i.amount_paid,
        'discountId': i.discount_id, 'discountName': i.discount_name or None, 'sentAt': ms(i.sent_at),
        'balance': balance, 'overdue': overdue, 'daysOverdue': (on - i.due_date).days if overdue else 0,
    }
    if with_lines:
        out['lines'] = [invoice_line(l) for l in i.lines.all()]
    return out


def payment(p, invoice_number=None, customer_name=None):
    return {'id': p.id, 'invoiceId': p.invoice_id, 'customerId': p.customer_id, 'method': p.method, 'amount': p.amount,
            'paidOn': iso(p.paid_on), 'note': p.note, 'recordedBy': p.recorded_by,
            'invoiceNumber': invoice_number, 'customer': customer_name}


def event(e):
    return {'id': e.id, 'entity': e.entity, 'entityId': e.entity_id, 'action': e.action, 'detail': e.detail, 'actor': e.actor, 'at': ms(e.at)}


def billing_run(r):
    return {'id': r.id, 'runDate': iso(r.run_date), 'created': r.created, 'skipped': r.skipped, 'closed': r.closed,
            'subsBilled': r.subs_billed, 'durationMs': r.duration_ms, 'by': r.by, 'at': ms(r.at)}
