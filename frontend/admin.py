from django.contrib import admin

from . import models as m


@admin.register(m.User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'name', 'role', 'customer', 'is_active')
    list_filter = ('role', 'is_active')
    search_fields = ('email', 'name')
    exclude = ('password',)


class SubscriptionLineInline(admin.TabularInline):
    model = m.SubscriptionLine
    extra = 0


@admin.register(m.Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('number', 'customer', 'plan', 'qty', 'state', 'start_date', 'next_billing_date', 'expiry_date')
    list_filter = ('state', 'plan')
    search_fields = ('number', 'customer__name')
    inlines = [SubscriptionLineInline]


class InvoiceLineInline(admin.TabularInline):
    model = m.InvoiceLine
    extra = 0


@admin.register(m.Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ('number', 'customer', 'period_start', 'due_date', 'state', 'total', 'amount_paid')
    list_filter = ('state',)
    search_fields = ('number', 'customer__name')
    inlines = [InvoiceLineInline]


for model in (m.Customer, m.Tax, m.Product, m.ProductVariant, m.RecurringPlan, m.Discount, m.QuotationTemplate,
              m.Payment, m.AuditEvent, m.BillingRun):
    admin.site.register(model)
