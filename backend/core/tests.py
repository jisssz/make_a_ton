"""python manage.py test core — checks the billing guarantees and access rules."""
from datetime import date, timedelta

from django.core import mail
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Customer, Discount, Invoice, RecurringPlan, Subscription, Tax, User
from .services.billing import bill_subscription, record_payment, run_billing
from .services.dates import add_months_anchored, today
from .services.pricing import price_subscription


class Base(TestCase):
    def setUp(self):
        self.gst = Tax.objects.create(name='GST 18%', rate=18)
        self.plan = RecurringPlan.objects.create(name='Monthly', period='MONTHLY', price=100000, tax=self.gst)
        self.kerala = Customer.objects.create(name='Kochi Co', email='k@x.in', state='Kerala')
        self.delhi = Customer.objects.create(name='Delhi Co', email='d@x.in', state='Delhi')
        self.admin = User.objects.create_user('a@x.in', 'Admin@12345', name='Admin', role='ADMIN')
        self.staff = User.objects.create_user('s@x.in', 'Staff@12345', name='Staff', role='STAFF')

    def sub(self, customer=None, start=None, qty=1):
        start = start or today() - timedelta(days=95)
        return Subscription.objects.create(number=f'SUB-{Subscription.objects.count() + 1}', customer=customer or self.kerala,
                                           plan=self.plan, qty=qty, state='ACTIVE', start_date=start, next_billing_date=start, anchor_day=start.day)


class BillingTests(Base):
    def test_never_bills_twice(self):
        self.sub()
        first = run_billing(self.staff)
        second = run_billing(self.staff)
        self.assertGreater(first.created, 0)
        self.assertEqual(second.created, 0)
        self.assertEqual(Invoice.objects.count(), first.created)

    def test_catches_up_missed_periods(self):
        s = self.sub(start=today() - timedelta(days=95))
        created, _ = bill_subscription(s, today())
        self.assertEqual(created, 4)  # ~3 months back + current period

    def test_month_end_does_not_drift(self):
        d, out = date(2026, 1, 31), []
        for _ in range(3):
            d = add_months_anchored(d, 1, 31)
            out.append(d)
        self.assertEqual(out, [date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)])

    def test_discount_before_tax_and_gst_split(self):
        Discount.objects.create(name='10%', kind='PERCENT', value=10, start_date=today() - timedelta(days=1), end_date=today() + timedelta(days=1))
        s = self.sub(qty=2)
        p = price_subscription(s, today())
        self.assertEqual(p['subtotal'], 200000)
        self.assertEqual(p['discountTotal'], 20000)
        self.assertEqual(p['taxTotal'], 32400)  # 18% of 180000
        self.assertEqual(p['lines'][0]['cgst'] + p['lines'][0]['sgst'], 32400)
        p2 = price_subscription(self.sub(customer=self.delhi, qty=2), today())
        self.assertEqual(p2['lines'][0]['igst'], 32400)

    def test_discount_usage_limit(self):
        Discount.objects.create(name='Once', kind='FIXED', value=5000, usage_limit=1, start_date=today() - timedelta(days=200), end_date=today())
        run_billing(self.staff)
        self.assertEqual(Invoice.objects.exclude(discount=None).count(), 0)  # no subs yet
        self.sub()
        run_billing(self.staff)
        self.assertEqual(Invoice.objects.exclude(discount=None).count(), 1)

    def test_partial_payment(self):
        self.sub()
        run_billing(self.staff)
        inv = Invoice.objects.first()
        Invoice.objects.filter(pk=inv.pk).update(state='CONFIRMED', number='INV/T/1')
        record_payment({'invoiceId': inv.id, 'method': 'UPI', 'amount': 1000, 'paidOn': today().isoformat()}, self.staff)
        inv.refresh_from_db()
        self.assertEqual(inv.state, 'PARTIAL')


class ApiAccessTests(Base):
    def client_for(self, email, password):
        c = APIClient()
        token = c.post('/api/auth/login/', {'email': email, 'password': password}, format='json').json()['token']
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return c

    def test_signup_rules(self):
        c = APIClient()
        weak = c.post('/api/auth/signup/', {'name': 'X', 'email': 'n@x.in', 'password': 'weak'}, format='json')
        self.assertEqual(weak.status_code, 400)
        dup = c.post('/api/auth/signup/', {'name': 'X', 'email': 'a@x.in', 'password': 'Strong@1234'}, format='json')
        self.assertIn('email', dup.json()['fields'])
        ok = c.post('/api/auth/signup/', {'name': 'X', 'email': 'n@x.in', 'password': 'Strong@1234'}, format='json')
        self.assertEqual(ok.json()['user']['role'], 'CUSTOMER')

    def test_customer_isolation(self):
        other = self.sub(customer=self.delhi)
        User.objects.create_user('c@x.in', 'Cust@12345', name='C', role='CUSTOMER', customer=self.kerala)
        c = self.client_for('c@x.in', 'Cust@12345')
        self.assertEqual(c.get(f'/api/subscriptions/{other.id}/').status_code, 404)
        self.assertEqual(c.get('/api/reports/dashboard/').status_code, 403)

    def test_only_admin_edits_catalog_and_staff(self):
        c = self.client_for('s@x.in', 'Staff@12345')
        self.assertEqual(c.post('/api/discounts/', {'name': 'x'}, format='json').status_code, 403)
        self.assertEqual(c.post('/api/users/', {}, format='json').status_code, 403)


class EmailAndProfileTests(ApiAccessTests):
    def test_me_and_password_reset_email(self):
        c = self.client_for('s@x.in', 'Staff@12345')
        self.assertEqual(c.get('/api/auth/me/').json()['role'], 'STAFF')
        APIClient().post('/api/auth/forgot/', {'email': 's@x.in'}, format='json')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('/reset-password/', mail.outbox[0].body)

    def test_send_invoice_emails_customer(self):
        self.sub()
        run_billing(self.staff)
        inv = Invoice.objects.first()
        c = self.client_for('s@x.in', 'Staff@12345')
        self.assertEqual(c.post(f'/api/invoices/{inv.id}/send/').status_code, 200)
        inv.refresh_from_db()
        self.assertEqual(inv.state, 'CONFIRMED')
        self.assertTrue(inv.number.startswith('INV/'))
        self.assertEqual(mail.outbox[-1].to, ['k@x.in'])
