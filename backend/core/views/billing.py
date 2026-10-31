"""Invoices, payments, billing run, dashboard and users."""
from django.conf import settings
from django.db.models import F, Q, Sum
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..errors import NotFound, check_fields
from ..models import AuditEvent, BillingRun, Invoice, Payment, User
from ..services import billing as B
from ..services import reports as R
from ..services import serializers as S
from ..services.dates import parse, today
from ..services.lifecycle import ensure_role
from ..validators import EMAIL_RE, password_problems
from .common import paginate, search


# ----------------------------------------------------------------- invoices
def _scoped_invoices(user):
    qs = Invoice.objects.select_related('customer', 'subscription')
    if user.role == 'CUSTOMER':  # customers only ever see their own, never drafts
        qs = qs.filter(customer_id=user.customer_id).exclude(state=Invoice.DRAFT)
    return qs


@api_view(['GET'])
def invoices(request):
    p = request.query_params
    qs = _scoped_invoices(request.user)
    f = p.get('filter')
    on = today()
    if f == 'overdue':
        qs = qs.filter(state__in=R.OPEN, due_date__lt=on).exclude(total=F('amount_paid'))
    elif f == 'unpaid':
        qs = qs.filter(state__in=R.OPEN)
    elif f:
        qs = qs.filter(state=f)
    if p.get('from'):
        qs = qs.filter(invoice_date__gte=p['from'])
    if p.get('to'):
        qs = qs.filter(invoice_date__lte=p['to'])
    qs = search(qs, p.get('q'), 'number', 'customer__name').order_by('-invoice_date', '-id')
    totals = qs.aggregate(sum_total=Sum('total'), sum_balance=Sum(F('total') - F('amount_paid'), filter=Q(state__in=R.OPEN)))
    return Response({**paginate(qs, request, lambda i: S.invoice(i, on=on)),
                     'totals': {'total': totals['sum_total'] or 0, 'balance': totals['sum_balance'] or 0}})


@api_view(['GET'])
def invoice_detail(request, pk):
    inv = _scoped_invoices(request.user).prefetch_related('lines').filter(pk=pk).first()
    if not inv:
        raise NotFound('Invoice')
    return Response({
        'invoice': S.invoice(inv, with_lines=True), 'customer': S.customer(inv.customer), 'company': settings.COMPANY,
        'subscription': {'id': inv.subscription_id, 'number': inv.subscription.number},
        'payments': [S.payment(p) for p in inv.payments.order_by('paid_on')],
        'events': [S.event(e) for e in AuditEvent.objects.filter(entity='invoice', entity_id=inv.id)],
    })


@api_view(['POST'])
def invoices_confirm(request):
    ids = list(Invoice.objects.filter(state=Invoice.DRAFT).values_list('id', flat=True)) if request.data.get('all') else request.data.get('ids') or []
    return Response(B.confirm_invoices(ids, request.user))


@api_view(['POST'])
def invoice_cancel(request, pk):
    B.cancel_invoice(pk, request.user)
    return Response(status=204)


@api_view(['POST'])
def invoice_send(request, pk):
    return Response(B.send_invoice(pk, request.user))


# ----------------------------------------------------------------- payments
@api_view(['GET', 'POST'])
def payments(request):
    if request.method == 'POST':
        pay = B.record_payment(request.data, request.user)
        return Response(S.payment(pay), status=201)
    B.require_staff(request.user)
    p = request.query_params
    qs = Payment.objects.select_related('invoice', 'customer')
    if p.get('method'):
        qs = qs.filter(method=p['method'])
    if p.get('from'):
        qs = qs.filter(paid_on__gte=p['from'])
    if p.get('to'):
        qs = qs.filter(paid_on__lte=p['to'])
    qs = search(qs, p.get('q'), 'invoice__number', 'customer__name', 'note').order_by('-paid_on', '-id')
    return Response({**paginate(qs, request, lambda x: S.payment(x, x.invoice.number, x.customer.name)),
                     'totalAmount': qs.aggregate(v=Sum('amount'))['v'] or 0})


# ------------------------------------------------------------------ billing
@api_view(['POST'])
def billing_run(request):
    run = B.run_billing(request.user, request.data.get('upTo'))
    return Response(S.billing_run(run))


@api_view(['GET'])
def billing_runs(request):
    B.require_staff(request.user)
    return Response({
        'runs': [S.billing_run(r) for r in BillingRun.objects.all()[:20]],
        'dueNow': len(R.due_subscriptions()), 'drafts': Invoice.objects.filter(state=Invoice.DRAFT).count(),
        'clock': None, 'today': today().isoformat(),
    })


@api_view(['GET'])
def dashboard(request):
    B.require_staff(request.user)
    p = request.query_params
    return Response(R.dashboard(parse(p.get('from')), parse(p.get('to')), p.get('planId') or None))


# -------------------------------------------------------------------- users
@api_view(['GET', 'POST'])
def users(request):
    ensure_role(request.user, 'ADMIN')
    if request.method == 'GET':
        return Response([S.user(u) for u in User.objects.order_by('role', 'name')])
    d = request.data
    email = (d.get('email') or '').strip().lower()
    fields = {}
    if not (d.get('name') or '').strip():
        fields['name'] = 'Name is required'
    if not EMAIL_RE.match(email):
        fields['email'] = 'Enter a valid email address'
    elif User.objects.filter(email=email).exists():
        fields['email'] = 'An account with this email already exists'
    if password_problems(d.get('password')):
        fields['password'] = 'Password does not meet the rules'
    check_fields(fields)
    role = d.get('role') if d.get('role') in ('ADMIN', 'STAFF') else 'STAFF'  # admins can never create customers here
    u = User.objects.create_user(email=email, password=d['password'], name=d['name'].strip(), role=role)
    B.audit('user', u.id, 'Staff added', f'{u.name} ({role})', request.user)
    return Response(S.user(u), status=201)


@api_view(['POST'])
def user_toggle(request, pk):
    ensure_role(request.user, 'ADMIN')
    u = User.objects.filter(pk=pk).first()
    if not u:
        raise NotFound('User')
    if u.pk == request.user.pk:
        from ..errors import AppError
        raise AppError('You cannot disable your own account')
    u.is_active = not u.is_active
    u.save(update_fields=['is_active'])
    return Response(S.user(u))
