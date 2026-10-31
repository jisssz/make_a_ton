from django.urls import path

from .views import auth, billing, catalog, subscriptions

urlpatterns = [
    # auth
    path('auth/login/', auth.login),
    path('auth/signup/', auth.signup),
    path('auth/forgot/', auth.forgot),
    path('auth/reset/', auth.reset),
    # reference data & dashboard
    path('lookups/', catalog.lookups),
    path('reports/dashboard/', billing.dashboard),
    # customers
    path('customers/', catalog.customers),
    path('customers/<int:pk>/', catalog.customer_detail),
    # catalog
    *[p for coll in catalog.SAVERS for p in (
        path(f'{coll}/', catalog.make_catalog_view(coll)),
        path(f'{coll}/<int:pk>/', catalog.make_catalog_view(coll)),
    )],
    path('products/<int:pk>/variants/', catalog.product_variants),
    path('templates/<int:pk>/draft/', catalog.template_draft),
    # subscriptions
    path('subscriptions/', subscriptions.subscriptions),
    path('subscriptions/<int:pk>/', subscriptions.subscription_detail),
    path('subscriptions/<int:pk>/transition/', subscriptions.subscription_transition),
    # invoices, payments, billing
    path('invoices/', billing.invoices),
    path('invoices/confirm/', billing.invoices_confirm),
    path('invoices/<int:pk>/', billing.invoice_detail),
    path('invoices/<int:pk>/cancel/', billing.invoice_cancel),
    path('invoices/<int:pk>/send/', billing.invoice_send),
    path('payments/', billing.payments),
    path('billing/run/', billing.billing_run),
    path('billing/runs/', billing.billing_runs),
    # users
    path('users/', billing.users),
    path('users/<int:pk>/toggle/', billing.user_toggle),
]
