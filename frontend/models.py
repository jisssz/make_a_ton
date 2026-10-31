"""
SubSync data model.

Money is stored as integer paise (BigIntegerField) — never floats.
Dates are plain dates in IST. Financial history is never deleted: invoices
are cancelled, not removed, and every invoice keeps a snapshot of its lines.
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


def today():
    return timezone.localdate()


# ----------------------------------------------------------------- identity
class Customer(models.Model):
    name = models.CharField(max_length=200)
    contact = models.CharField(max_length=120, blank=True)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    city = models.CharField(max_length=80, blank=True)
    state = models.CharField(max_length=80, default='Kerala')  # decides CGST+SGST vs IGST
    gstin = models.CharField(max_length=15, blank=True)
    created_at = models.DateField(default=today)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.update(role=User.ADMIN, is_staff=True, is_superuser=True)
        extra.setdefault('name', 'Admin')
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    ADMIN, STAFF, CUSTOMER = 'ADMIN', 'STAFF', 'CUSTOMER'
    ROLES = [(ADMIN, 'Admin'), (STAFF, 'Internal staff'), (CUSTOMER, 'Customer')]

    email = models.EmailField(unique=True)  # one account per email
    name = models.CharField(max_length=120)
    role = models.CharField(max_length=10, choices=ROLES, default=CUSTOMER)
    customer = models.ForeignKey(Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name='users')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)  # Django admin access only
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return f'{self.name} <{self.email}>'


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token_hash = models.CharField(max_length=64, unique=True)  # only the hash is stored
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)


# ------------------------------------------------------------------ catalog
class Tax(models.Model):
    name = models.CharField(max_length=60)
    rate = models.DecimalField(max_digits=5, decimal_places=2)  # percent, e.g. 18.00
    type = models.CharField(max_length=20, default='GST')
    active = models.BooleanField(default=True)


class Product(models.Model):
    name = models.CharField(max_length=120)
    type = models.CharField(max_length=20, default='Service')
    sales_price = models.BigIntegerField()  # paise
    cost_price = models.BigIntegerField(default=0)
    notes = models.CharField(max_length=255, blank=True)
    tax = models.ForeignKey(Tax, null=True, blank=True, on_delete=models.SET_NULL)
    active = models.BooleanField(default=True)


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    attribute = models.CharField(max_length=60)  # e.g. Brand
    value = models.CharField(max_length=60)  # e.g. Odoo
    extra_price = models.BigIntegerField(default=0)  # e.g. +56000 paise


class RecurringPlan(models.Model):
    DAILY, WEEKLY, MONTHLY, YEARLY = 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'
    PERIODS = [(DAILY, 'Daily'), (WEEKLY, 'Weekly'), (MONTHLY, 'Monthly'), (YEARLY, 'Yearly')]

    name = models.CharField(max_length=120)
    period = models.CharField(max_length=10, choices=PERIODS)
    price = models.BigIntegerField()  # paise per seat per period
    min_qty = models.PositiveIntegerField(default=1)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    tax = models.ForeignKey(Tax, null=True, blank=True, on_delete=models.SET_NULL)
    auto_close = models.BooleanField(default=False)
    closable = models.BooleanField(default=True)
    pausable = models.BooleanField(default=True)
    renewable = models.BooleanField(default=True)
    active = models.BooleanField(default=True)


class Discount(models.Model):
    PERCENT, FIXED = 'PERCENT', 'FIXED'
    SUBSCRIPTION, PRODUCT = 'SUBSCRIPTION', 'PRODUCT'

    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=10, choices=[(PERCENT, 'Percentage'), (FIXED, 'Fixed amount')])
    value = models.DecimalField(max_digits=14, decimal_places=2)  # percent (e.g. 10) or paise for FIXED
    min_amount = models.BigIntegerField(default=0)
    min_qty = models.PositiveIntegerField(default=0)
    start_date = models.DateField()
    end_date = models.DateField()
    usage_limit = models.PositiveIntegerField(default=0)  # 0 = unlimited
    times_used = models.PositiveIntegerField(default=0)
    scope = models.CharField(max_length=15, default=SUBSCRIPTION)
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.CASCADE)
    active = models.BooleanField(default=True)


class QuotationTemplate(models.Model):
    name = models.CharField(max_length=120)
    plan = models.ForeignKey(RecurringPlan, on_delete=models.PROTECT)
    qty = models.PositiveIntegerField(default=1)
    validity_days = models.PositiveIntegerField(default=15)
    payment_terms_days = models.PositiveIntegerField(default=15)
    duration_months = models.PositiveIntegerField(default=12)
    notes = models.CharField(max_length=255, blank=True)


class QuotationTemplateLine(models.Model):
    template = models.ForeignKey(QuotationTemplate, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.SET_NULL)
    qty = models.PositiveIntegerField(default=1)


# ------------------------------------------------------------ subscriptions
class Subscription(models.Model):
    DRAFT, QUOTATION, CONFIRMED, ACTIVE, PAUSED, CLOSED = 'DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED', 'CLOSED'
    STATES = [(s, s.title()) for s in (DRAFT, QUOTATION, CONFIRMED, ACTIVE, PAUSED, CLOSED)]

    number = models.CharField(max_length=20, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='subscriptions')
    plan = models.ForeignKey(RecurringPlan, on_delete=models.PROTECT)
    template = models.ForeignKey(QuotationTemplate, null=True, blank=True, on_delete=models.SET_NULL)
    qty = models.PositiveIntegerField(default=1)
    state = models.CharField(max_length=10, choices=STATES, default=DRAFT)
    start_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    next_billing_date = models.DateField(null=True, blank=True)
    anchor_day = models.PositiveSmallIntegerField()  # keeps month-end billing from drifting
    payment_terms_days = models.PositiveIntegerField(default=15)
    valid_until = models.DateField(null=True, blank=True)  # quotation validity
    activated_on = models.DateField(null=True, blank=True)
    paused_on = models.DateField(null=True, blank=True)
    closed_on = models.DateField(null=True, blank=True)
    close_reason = models.CharField(max_length=120, blank=True)
    created_at = models.DateField(default=today)

    class Meta:
        indexes = [
            models.Index(fields=['state', 'next_billing_date']),  # due-for-billing query
            models.Index(fields=['customer']),
            models.Index(fields=['expiry_date']),
        ]


class SubscriptionLine(models.Model):
    subscription = models.ForeignKey(Subscription, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.SET_NULL)
    qty = models.PositiveIntegerField(default=1)
    unit_price = models.BigIntegerField()
    tax = models.ForeignKey(Tax, null=True, blank=True, on_delete=models.SET_NULL)


# ------------------------------------------------------------------ billing
class Invoice(models.Model):
    DRAFT, CONFIRMED, PARTIAL, PAID, CANCELLED = 'DRAFT', 'CONFIRMED', 'PARTIAL', 'PAID', 'CANCELLED'
    STATES = [(DRAFT, 'Draft'), (CONFIRMED, 'Confirmed'), (PARTIAL, 'Partially paid'), (PAID, 'Paid'), (CANCELLED, 'Cancelled')]

    number = models.CharField(max_length=30, unique=True, null=True, blank=True)  # assigned on confirm
    subscription = models.ForeignKey(Subscription, on_delete=models.PROTECT, related_name='invoices')
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='invoices')
    period_start = models.DateField()
    period_end = models.DateField()
    invoice_date = models.DateField()
    due_date = models.DateField()
    state = models.CharField(max_length=10, choices=STATES, default=DRAFT)
    subtotal = models.BigIntegerField(default=0)
    discount_total = models.BigIntegerField(default=0)
    tax_total = models.BigIntegerField(default=0)
    total = models.BigIntegerField(default=0)
    amount_paid = models.BigIntegerField(default=0)  # kept in sync inside the payment transaction
    discount = models.ForeignKey(Discount, null=True, blank=True, on_delete=models.SET_NULL)
    discount_name = models.CharField(max_length=120, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # The core guarantee: a subscription can never be billed twice for the same period.
            models.UniqueConstraint(fields=['subscription', 'period_start'], name='one_invoice_per_period'),
        ]
        indexes = [models.Index(fields=['state', 'due_date']), models.Index(fields=['customer']), models.Index(fields=['invoice_date'])]

    @property
    def balance(self):
        return self.total - self.amount_paid


class InvoiceLine(models.Model):
    """Snapshot of what was billed — later price changes never rewrite history."""
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='lines')
    kind = models.CharField(max_length=10)  # PLAN or PRODUCT
    product = models.ForeignKey(Product, null=True, blank=True, on_delete=models.SET_NULL)
    description = models.CharField(max_length=200)
    qty = models.PositiveIntegerField()
    unit_price = models.BigIntegerField()
    base = models.BigIntegerField()
    discount = models.BigIntegerField(default=0)
    taxable = models.BigIntegerField()
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    tax_name = models.CharField(max_length=60, blank=True)
    tax = models.BigIntegerField(default=0)
    cgst = models.BigIntegerField(default=0)
    sgst = models.BigIntegerField(default=0)
    igst = models.BigIntegerField(default=0)
    total = models.BigIntegerField()


class Payment(models.Model):
    METHODS = [('UPI', 'UPI'), ('BANK', 'Bank transfer'), ('CARD', 'Card'), ('CASH', 'Cash')]
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name='payments')
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='payments')
    method = models.CharField(max_length=10, choices=METHODS)
    amount = models.BigIntegerField()
    paid_on = models.DateField()
    note = models.CharField(max_length=255, blank=True)
    recorded_by = models.CharField(max_length=120, blank=True)

    class Meta:
        indexes = [models.Index(fields=['paid_on'])]


# --------------------------------------------------------------- operations
class AuditEvent(models.Model):
    entity = models.CharField(max_length=30)
    entity_id = models.BigIntegerField(default=0)
    action = models.CharField(max_length=80)
    detail = models.CharField(max_length=255, blank=True)
    actor = models.CharField(max_length=120, default='System')
    at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-at', '-id']
        indexes = [models.Index(fields=['entity', 'entity_id'])]


class BillingRun(models.Model):
    run_date = models.DateField()
    created = models.PositiveIntegerField(default=0)
    skipped = models.PositiveIntegerField(default=0)
    closed = models.PositiveIntegerField(default=0)
    subs_billed = models.PositiveIntegerField(default=0)
    duration_ms = models.PositiveIntegerField(default=0)
    by = models.CharField(max_length=120, default='Scheduler')
    at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-at']


class Sequence(models.Model):
    """Gap-free counters for SUB-/INV/ numbers, updated inside transactions."""
    code = models.CharField(max_length=30, primary_key=True)
    next_value = models.PositiveIntegerField(default=1)
