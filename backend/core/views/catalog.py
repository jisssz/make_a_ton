"""Customers and catalog: products & variants, recurring plans, taxes, discounts, quotation templates."""
import re

from django.conf import settings
from django.db import transaction
from django.db.models import F, Sum
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..errors import NotFound, check_fields
from ..models import (Customer, Discount, Invoice, Payment, Product, ProductVariant, QuotationTemplate,
                      QuotationTemplateLine, RecurringPlan, Subscription, Tax)
from ..services import serializers as S
from ..services.billing import audit, require_staff
from ..services.dates import parse
from ..services.lifecycle import draft_from_template, ensure_role
from ..services.reports import SUB_FIELDS, mrr_map
from ..validators import EMAIL_RE
from .common import paginate, search


def _int(v, default=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


@api_view(['GET'])
def lookups(request):
    """Reference data for forms and dropdowns."""
    return Response({
        'customers': [S.customer(c) for c in Customer.objects.all()] if request.user.role != 'CUSTOMER' else [],
        'plans': [S.plan(p) for p in RecurringPlan.objects.order_by('id')],
        'products': [S.product(p) for p in Product.objects.order_by('id')],
        'variants': [S.variant(v) for v in ProductVariant.objects.order_by('id')],
        'taxes': [S.tax(t) for t in Tax.objects.order_by('id')],
        'discounts': [S.discount(d) for d in Discount.objects.order_by('id')],
        'templates': [S.template(t) for t in QuotationTemplate.objects.prefetch_related('lines').order_by('id')],
        'company': settings.COMPANY,
    })


# ---------------------------------------------------------------- customers
@api_view(['GET', 'POST'])
def customers(request):
    require_staff(request.user)
    if request.method == 'POST':
        return Response(S.customer(_save_customer(request.data, request.user)), status=201)
    qs = search(Customer.objects.all(), request.query_params.get('q'), 'name', 'email', 'city')
    rows = list(qs.values('id'))
    ids = [r['id'] for r in rows]
    active = list(Subscription.objects.filter(customer_id__in=ids, state='ACTIVE').values(*SUB_FIELDS))
    mrr = mrr_map(active)
    per_customer, counts = {}, {}
    for s in active:
        per_customer[s['customer_id']] = per_customer.get(s['customer_id'], 0) + mrr[s['id']]
        counts[s['customer_id']] = counts.get(s['customer_id'], 0) + 1
    due = dict(Invoice.objects.filter(customer_id__in=ids, state__in=['CONFIRMED', 'PARTIAL']).values_list('customer_id')
               .annotate(v=Sum(F('total') - F('amount_paid'))))
    ordered = sorted(qs, key=lambda c: -per_customer.get(c.id, 0))

    def ser(c):
        return {**S.customer(c), 'activeSubs': counts.get(c.id, 0), 'mrr': per_customer.get(c.id, 0), 'outstanding': due.get(c.id, 0)}
    return Response(paginate(ordered, request, ser))


@api_view(['GET', 'PUT'])
def customer_detail(request, pk):
    require_staff(request.user)
    c = Customer.objects.filter(pk=pk).first()
    if not c:
        raise NotFound('Customer')
    if request.method == 'PUT':
        return Response(S.customer(_save_customer({**request.data, 'id': pk}, request.user)))
    subs = Subscription.objects.filter(customer=c).select_related('customer', 'plan').prefetch_related('lines').order_by('-id')
    invs = Invoice.objects.filter(customer=c).select_related('customer', 'subscription').order_by('-invoice_date')[:50]
    pays = Payment.objects.filter(customer=c).order_by('-paid_on')[:20]
    return Response({'customer': S.customer(c), 'subscriptions': [S.subscription(s) for s in subs],
                     'invoices': [S.invoice(i) for i in invs], 'payments': [S.payment(p) for p in pays]})


def _save_customer(d, actor):
    fields = {}
    if not (d.get('name') or '').strip():
        fields['name'] = 'Company name is required'
    if not EMAIL_RE.match((d.get('email') or '').strip()):
        fields['email'] = 'Enter a valid email address'
    if d.get('gstin') and not re.match(r'^[0-9]{2}[A-Z0-9]{13}$', d['gstin']):
        fields['gstin'] = 'GSTIN should be 15 characters'
    check_fields(fields)
    c = Customer.objects.filter(pk=d.get('id') or 0).first() or Customer()
    for f in ('name', 'contact', 'email', 'phone', 'city', 'state', 'gstin'):
        setattr(c, f, (d.get(f) or '').strip() if f != 'state' else d.get(f) or settings.COMPANY['state'])
    c.save()
    audit('customer', c.id, 'Saved', c.name, actor)
    return c


# ------------------------------------------------------------------ catalog (admin only)
def _save_product(d):
    fields = {}
    if not (d.get('name') or '').strip():
        fields['name'] = 'Name is required'
    if _int(d.get('salesPrice'), -1) < 0:
        fields['salesPrice'] = 'Enter a sales price'
    check_fields(fields)
    p = Product.objects.filter(pk=d.get('id') or 0).first() or Product()
    p.name, p.type, p.notes = d['name'].strip(), d.get('type') or 'Service', d.get('notes') or ''
    p.sales_price, p.cost_price = _int(d['salesPrice']), max(0, _int(d.get('costPrice')))
    p.tax_id, p.active = d.get('taxId') or None, d.get('active', True)
    p.save()
    return S.product(p)


def _save_plan(d):
    fields = {}
    if not (d.get('name') or '').strip():
        fields['name'] = 'Name is required'
    if _int(d.get('price'), -1) < 0:
        fields['price'] = 'Enter a price'
    if d.get('period') not in dict(RecurringPlan.PERIODS):
        fields['period'] = 'Choose daily, weekly, monthly or yearly'
    if _int(d.get('minQty')) < 1:
        fields['minQty'] = 'Minimum quantity must be at least 1'
    start, end = parse(d.get('startDate')), parse(d.get('endDate'))
    if start and end and end <= start:
        fields['endDate'] = 'End date must be after start date'
    check_fields(fields)
    p = RecurringPlan.objects.filter(pk=d.get('id') or 0).first() or RecurringPlan()
    p.name, p.period, p.price, p.min_qty = d['name'].strip(), d['period'], _int(d['price']), _int(d['minQty'])
    p.start_date, p.end_date, p.tax_id = start, end, d.get('taxId') or None
    for f, key in (('auto_close', 'autoClose'), ('closable', 'closable'), ('pausable', 'pausable'), ('renewable', 'renewable'), ('active', 'active')):
        setattr(p, f, bool(d.get(key, f != 'auto_close')))
    p.save()
    return S.plan(p)


def _save_tax(d):
    fields = {}
    if not (d.get('name') or '').strip():
        fields['name'] = 'Name is required'
    try:
        rate = float(d.get('rate'))
        if not 0 <= rate <= 100:
            raise ValueError
    except (TypeError, ValueError):
        fields['rate'] = 'Rate must be 0–100'
    check_fields(fields)
    t = Tax.objects.filter(pk=d.get('id') or 0).first() or Tax()
    t.name, t.rate, t.type, t.active = d['name'].strip(), d['rate'], d.get('type') or 'GST', d.get('active', True)
    t.save()
    return S.tax(t)


def _save_discount(d):
    fields = {}
    start, end = parse(d.get('startDate')), parse(d.get('endDate'))
    try:
        value = float(d.get('value'))
    except (TypeError, ValueError):
        value = 0
    if not (d.get('name') or '').strip():
        fields['name'] = 'Name is required'
    if value <= 0:
        fields['value'] = 'Enter a value above 0'
    elif d.get('kind') == 'PERCENT' and value > 100:
        fields['value'] = 'Percentage cannot exceed 100'
    if not start:
        fields['startDate'] = 'Start date is required'
    if not end:
        fields['endDate'] = 'End date is required'
    elif start and end < start:
        fields['endDate'] = 'End date must be after start date'
    if d.get('scope') == 'PRODUCT' and not Product.objects.filter(pk=d.get('productId') or 0).exists():
        fields['productId'] = 'Choose a product'
    check_fields(fields)
    x = Discount.objects.filter(pk=d.get('id') or 0).first() or Discount()
    x.name, x.kind, x.value = d['name'].strip(), d.get('kind') or 'PERCENT', value
    x.min_amount, x.min_qty, x.usage_limit = max(0, _int(d.get('minAmount'))), max(0, _int(d.get('minQty'))), max(0, _int(d.get('usageLimit')))
    x.start_date, x.end_date, x.scope = start, end, d.get('scope') or 'SUBSCRIPTION'
    x.product_id = d.get('productId') if x.scope == 'PRODUCT' else None
    x.active = bool(d.get('active', True))
    x.save()
    return S.discount(x)


@transaction.atomic
def _save_template(d):
    fields = {}
    plan = RecurringPlan.objects.filter(pk=d.get('planId') or 0).first()
    if not (d.get('name') or '').strip():
        fields['name'] = 'Name is required'
    if not plan:
        fields['planId'] = 'Choose a plan'
    elif _int(d.get('qty')) < plan.min_qty:
        fields['qty'] = f'Plan needs at least {plan.min_qty}'
    if _int(d.get('validityDays')) < 1:
        fields['validityDays'] = 'At least 1 day'
    check_fields(fields)
    t = QuotationTemplate.objects.filter(pk=d.get('id') or 0).first() or QuotationTemplate()
    t.name, t.plan, t.qty, t.validity_days = d['name'].strip(), plan, _int(d['qty']), _int(d['validityDays'])
    t.payment_terms_days, t.duration_months, t.notes = _int(d.get('paymentTermsDays'), 15), _int(d.get('durationMonths')), d.get('notes') or ''
    t.save()
    t.lines.all().delete()
    for l in d.get('lines') or []:
        QuotationTemplateLine.objects.create(template=t, product_id=l['productId'], variant_id=l.get('variantId') or None, qty=_int(l.get('qty'), 1))
    return S.template(t)


SAVERS = {'products': _save_product, 'plans': _save_plan, 'taxes': _save_tax, 'discounts': _save_discount, 'templates': _save_template}
ADMIN_ONLY = {'products', 'plans', 'taxes', 'discounts'}


def make_catalog_view(coll):
    @api_view(['GET', 'POST', 'PUT'])
    def view(request, pk=None):
        if request.method == 'GET':
            return lookups(request._request)
        ensure_role(request.user, 'ADMIN') if coll in ADMIN_ONLY else require_staff(request.user)
        data = {**request.data, 'id': pk} if pk else request.data
        saved = SAVERS[coll](data)
        audit(coll, saved['id'], 'Updated' if pk else 'Created', saved.get('name', ''), request.user)
        return Response(saved, status=200 if pk else 201)
    view.__name__ = f'{coll}_view'
    return view


@api_view(['PUT'])
@transaction.atomic
def product_variants(request, pk):
    ensure_role(request.user, 'ADMIN')
    product = Product.objects.filter(pk=pk).first()
    if not product:
        raise NotFound('Product')
    rows = request.data if isinstance(request.data, list) else []
    fields = {f'v{i}': 'Attribute and value are required' for i, v in enumerate(rows) if not (v.get('attribute') and v.get('value'))}
    check_fields(fields)
    keep = []
    for v in rows:  # update in place so existing subscription lines keep their variant
        obj, _ = ProductVariant.objects.update_or_create(product=product, attribute=v['attribute'].strip(), value=v['value'].strip(),
                                                         defaults={'extra_price': max(0, _int(v.get('extraPrice')))})
        keep.append(obj.id)
    product.variants.exclude(id__in=keep).delete()
    return Response([S.variant(v) for v in product.variants.all()])


@api_view(['GET'])
def template_draft(request, pk):
    require_staff(request.user)
    return Response(draft_from_template(pk))
