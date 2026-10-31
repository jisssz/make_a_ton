"""Subscriptions: list, detail (with next-invoice preview), create/edit, lifecycle transitions."""
from datetime import timedelta

from django.db.models import Count
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ..models import AuditEvent, Discount, Subscription
from ..services import serializers as S
from ..services.dates import today
from ..services.lifecycle import allowed_actions, get_for_actor, save_subscription, transition
from ..services.pricing import price_subscription
from .common import paginate, search


def _scoped(user):
    qs = Subscription.objects.select_related('customer', 'plan').prefetch_related('lines')
    return qs.filter(customer_id=user.customer_id) if user.role == 'CUSTOMER' else qs


@api_view(['GET', 'POST'])
def subscriptions(request):
    if request.method == 'POST':
        sub = save_subscription(request.data, request.user)
        return Response(S.subscription(Subscription.objects.select_related('customer', 'plan').get(pk=sub.pk)), status=201)
    p = request.query_params
    qs = _scoped(request.user)
    base = Subscription.objects.filter(customer_id=request.user.customer_id) if request.user.role == 'CUSTOMER' else Subscription.objects.all()
    counts = dict(base.values_list('state').annotate(n=Count('id')).order_by())
    if p.get('state'):
        qs = qs.filter(state=p['state'])
    if p.get('planId'):
        qs = qs.filter(plan_id=p['planId'])
    if p.get('expiring'):
        on = today()
        qs = qs.filter(state__in=['ACTIVE', 'PAUSED'], expiry_date__gte=on, expiry_date__lte=on + timedelta(days=30))
    qs = search(qs, p.get('q'), 'number', 'customer__name').order_by('-id')
    return Response({**paginate(qs, request, S.subscription), 'counts': counts})


@api_view(['GET', 'PUT'])
def subscription_detail(request, pk):
    if request.method == 'PUT':
        sub = save_subscription({**request.data, 'id': pk}, request.user)
        return Response(S.subscription(Subscription.objects.select_related('customer', 'plan').get(pk=sub.pk)))
    sub = get_for_actor(pk, request.user)
    preview = price_subscription(sub, sub.next_billing_date or sub.start_date, discounts=list(Discount.objects.filter(active=True)))
    preview.pop('discount')
    invoices = sub.invoices.select_related('customer', 'subscription').order_by('-period_start')
    if request.user.role == 'CUSTOMER':
        invoices = invoices.exclude(state='DRAFT')
    events = AuditEvent.objects.filter(entity='subscription', entity_id=sub.id)
    return Response({
        'sub': S.subscription(sub), 'plan': S.plan(sub.plan), 'customer': S.customer(sub.customer), 'preview': preview,
        'actions': allowed_actions(sub, request.user.role), 'invoices': [S.invoice(i) for i in invoices],
        'events': [S.event(e) for e in events] if request.user.role != 'CUSTOMER' else [],
        'template': S.template(sub.template) if sub.template else None,
    })


@api_view(['POST'])
def subscription_transition(request, pk):
    sub = transition(pk, request.data.get('action'), request.user)
    return Response(S.subscription(Subscription.objects.select_related('customer', 'plan').get(pk=sub.pk)))
