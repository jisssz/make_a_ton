"""Sign up, log in, password reset. Signup always creates a Customer account."""
import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from ..errors import AppError, check_fields
from ..models import Customer, PasswordResetToken, User
from ..services import serializers as S
from ..services.billing import audit
from ..validators import EMAIL_RE, password_problems


class AuthThrottle(AnonRateThrottle):
    rate = '20/min'  # slows down password guessing


def session_for(user):
    return {'user': S.user(user), 'token': str(RefreshToken.for_user(user).access_token)}


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def login(request):
    email = (request.data.get('email') or '').strip().lower()
    user = authenticate(request, email=email, password=request.data.get('password') or '')
    if not user:
        raise AppError('Incorrect email or password', code=401)
    return Response(session_for(user))


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def signup(request):
    d = request.data
    email = (d.get('email') or '').strip().lower()
    password = d.get('password') or ''
    fields = {}
    if not (d.get('name') or '').strip():
        fields['name'] = 'Name is required'
    if not EMAIL_RE.match(email):
        fields['email'] = 'Enter a valid email address'
    elif User.objects.filter(email=email).exists():
        fields['email'] = 'An account with this email already exists'
    if password_problems(password):
        fields['password'] = 'Password needs: ' + ', '.join(password_problems(password)).lower()
    check_fields(fields)
    with transaction.atomic():
        customer = Customer.objects.create(name=(d.get('company') or d['name']).strip(), contact=d['name'].strip(), email=email,
                                           state=d.get('state') or settings.COMPANY['state'])
        user = User.objects.create_user(email=email, password=password, name=d['name'].strip(), role=User.CUSTOMER, customer=customer)
    audit('user', user.id, 'Signed up', email, user)
    return Response(session_for(user), status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def forgot(request):
    email = (request.data.get('email') or '').strip().lower()
    user = User.objects.filter(email=email, is_active=True).first()
    body = {'detail': 'If an account exists, a reset link has been sent.'}  # same answer either way
    if user:
        token = secrets.token_urlsafe(32)
        PasswordResetToken.objects.create(user=user, token_hash=hashlib.sha256(token.encode()).hexdigest(),
                                          expires_at=timezone.now() + timedelta(minutes=settings.RESET_TOKEN_MINUTES))
        path = f'/reset-password/{token}'
        send_mail('Reset your SubSync password', f'Open this link within {settings.RESET_TOKEN_MINUTES} minutes:\n{settings.FRONTEND_URL}{path}',
                  settings.DEFAULT_FROM_EMAIL, [email])
        if settings.DEBUG:
            body['devLink'] = path  # dev only: shown in the "demo mail outbox"
    return Response(body)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def reset(request):
    raw = request.data.get('token') or ''
    password = request.data.get('password') or ''
    t = PasswordResetToken.objects.select_related('user').filter(token_hash=hashlib.sha256(raw.encode()).hexdigest()).first()
    if not t or t.used_at or t.expires_at < timezone.now():
        raise AppError('This reset link is invalid or has expired')
    if password_problems(password):
        raise AppError('Password does not meet the rules', {'password': 'Password does not meet the rules'})
    with transaction.atomic():
        t.user.set_password(password)
        t.user.save(update_fields=['password'])
        t.used_at = timezone.now()
        t.save(update_fields=['used_at'])
    audit('user', t.user.id, 'Password reset', t.user.email, t.user)
    return Response(status=204)
