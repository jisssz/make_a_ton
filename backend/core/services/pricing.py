"""
Invoice pricing — a pure calculation shared by the billing run and previews.

Order of operations (fixed and documented):
  plan fee + product lines -> best eligible discount (one per invoice) -> GST per line -> total
"""
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings

from ..models import Discount
from .dates import MONTHLY_FACTOR


def _round(x):
    return int(Decimal(x).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def gst_split(customer_state, rate, taxable):
    """Same state as the company -> CGST + SGST, otherwise IGST."""
    if not rate:
        return {'tax': 0, 'cgst': 0, 'sgst': 0, 'igst': 0}
    tax = _round(Decimal(taxable) * Decimal(rate) / 100)
    if customer_state == settings.COMPANY['state']:
        cgst = _round(Decimal(tax) / 2)
        return {'tax': tax, 'cgst': cgst, 'sgst': tax - cgst, 'igst': 0}
    return {'tax': tax, 'cgst': 0, 'sgst': 0, 'igst': tax}


def sub_mrr(sub, lines=None):
    """Normalised monthly recurring value before tax."""
    lines = list(sub.lines.all()) if lines is None else lines
    per_period = sub.plan.price * sub.qty + sum(l.unit_price * l.qty for l in lines)
    return round(per_period * MONTHLY_FACTOR[sub.plan.period])


def _discount_amount(d, lines, invoice_date, total_qty, subtotal):
    if not d.active or invoice_date < d.start_date or invoice_date > d.end_date:
        return 0
    if d.usage_limit and d.times_used >= d.usage_limit:
        return 0
    if d.scope == Discount.PRODUCT:
        eligible = [l for l in lines if l['productId'] == d.product_id]
        base, qty = sum(l['base'] for l in eligible), sum(l['qty'] for l in eligible)
    else:
        base, qty = subtotal, total_qty
    if not base or (d.min_amount and subtotal < d.min_amount) or (d.min_qty and qty < d.min_qty):
        return 0
    amount = _round(Decimal(base) * d.value / 100) if d.kind == Discount.PERCENT else int(d.value)
    return min(amount, base)  # never a negative total


def price_subscription(sub, invoice_date, lines=None, discounts=None):
    plan, customer = sub.plan, sub.customer
    lines = list(sub.lines.select_related('product', 'variant', 'tax')) if lines is None else lines
    discounts = list(Discount.objects.filter(active=True)) if discounts is None else discounts

    out = [{
        'kind': 'PLAN', 'productId': None, 'description': f'{plan.name} plan', 'qty': sub.qty, 'unitPrice': plan.price,
        'base': plan.price * sub.qty, 'taxRate': plan.tax.rate if plan.tax else 0, 'taxName': plan.tax.name if plan.tax else 'No tax',
    }]
    for l in lines:
        label = l.product.name + (f' ({l.variant.attribute}: {l.variant.value})' if l.variant else '')
        out.append({
            'kind': 'PRODUCT', 'productId': l.product_id, 'description': label, 'qty': l.qty, 'unitPrice': l.unit_price,
            'base': l.unit_price * l.qty, 'taxRate': l.tax.rate if l.tax else 0, 'taxName': l.tax.name if l.tax else 'No tax',
        })
    subtotal = sum(l['base'] for l in out)
    total_qty = sum(l['qty'] for l in out)

    best, best_amt = None, 0
    for d in discounts:
        a = _discount_amount(d, out, invoice_date, total_qty, subtotal)
        if a > best_amt:
            best, best_amt = d, a

    # Spread the discount over the eligible lines so GST is charged on the discounted value
    eligible = [l for l in out if best and (best.scope != Discount.PRODUCT or l['productId'] == best.product_id)]
    eligible_base = sum(l['base'] for l in eligible)
    remaining = best_amt
    for l in out:
        l['discount'] = 0
    for i, l in enumerate(eligible):
        share = remaining if i == len(eligible) - 1 else _round(Decimal(best_amt) * l['base'] / eligible_base)
        l['discount'] = min(share, l['base'])
        remaining -= l['discount']

    for l in out:
        l['taxable'] = l['base'] - l['discount']
        l.update(gst_split(customer.state, l['taxRate'], l['taxable']))
        l['total'] = l['taxable'] + l['tax']
        l['taxRate'] = float(l['taxRate'])

    discount_total = sum(l['discount'] for l in out)
    tax_total = sum(l['tax'] for l in out)
    return {
        'lines': out, 'subtotal': subtotal, 'discountTotal': discount_total, 'taxTotal': tax_total,
        'total': subtotal - discount_total + tax_total,
        'discount': best if best_amt else None, 'discountId': best.id if best_amt else None,
        'discountName': best.name if best_amt else None,
    }
