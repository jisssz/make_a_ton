"""
python manage.py seed [--subs 260] [--fresh]

Loads realistic demo data: catalog, plans, discounts, templates, customers, demo users,
subscriptions with a year of invoices created by the real billing engine, and payments.
"""
import random
from datetime import datetime, time, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import (AuditEvent, BillingRun, Customer, Discount, Invoice, Payment, PasswordResetToken, Product,
                         ProductVariant, QuotationTemplate, QuotationTemplateLine, RecurringPlan, Sequence, Subscription,
                         SubscriptionLine, Tax, User)
from core.services.billing import bill_subscription, confirm_invoices
from core.services.dates import add_months_anchored, today

P = lambda rupees: int(round(rupees * 100))  # noqa: E731
CUSTOMERS = ['Kochi Digital Studio', 'Malabar Spice Traders', 'Thrissur Textiles', 'Periyar Health Clinic', 'Lotus Learning Hub',
             'Coastline Logistics', 'Greenleaf Organics', 'Bharat Auto Parts', 'Sahyadri Software', 'Nila Interiors', 'Ganga Retail Mart',
             'Deccan Fintech', 'Pink City Crafts', 'Konark Travels', 'Brahmaputra Tea Co', 'Marina Bay Foods', 'Silicon Plateau Labs',
             'Narmada Builders', 'Himalaya Wellness', 'Vindhya Media', 'Cauvery Dairy', 'Aravalli Steel', 'Godavari Pharma',
             'Western Ghats Resorts', 'Saffron Events', 'Indigo Print House', 'Monsoon Cafe Chain', 'Tusker Security', 'Banyan Legal',
             'Peacock Fashion']
PLACES = [('Kochi', 'Kerala'), ('Thrissur', 'Kerala'), ('Kozhikode', 'Kerala'), ('Bengaluru', 'Karnataka'), ('Chennai', 'Tamil Nadu'),
          ('Mumbai', 'Maharashtra'), ('Pune', 'Maharashtra'), ('Hyderabad', 'Telangana'), ('Jaipur', 'Rajasthan'), ('Delhi', 'Delhi'),
          ('Kolkata', 'West Bengal'), ('Ahmedabad', 'Gujarat')]


class Command(BaseCommand):
    help = 'Load SubSync demo data'

    def add_arguments(self, parser):
        parser.add_argument('--subs', type=int, default=260)
        parser.add_argument('--fresh', action='store_true', help='Delete existing data first')

    def handle(self, *args, subs, fresh, **opts):
        if fresh:
            self.wipe()
        elif Subscription.objects.exists():
            self.stdout.write('Data already present — use --fresh to reload, or --subs N without data to add.')
            return
        rnd = random.Random(20261031)
        on = today()
        with transaction.atomic():
            self.catalog(on)
            self.people(rnd)
        self.subscriptions(rnd, on, subs)
        self.stdout.write(self.style.SUCCESS(
            f'Seeded {Subscription.objects.count()} subscriptions, {Invoice.objects.count()} invoices, {Payment.objects.count()} payments.\n'
            'Logins: admin@subsync.in / Admin@12345 · staff@subsync.in / Staff@12345 · customer@subsync.in / Customer@123'))

    def wipe(self):
        for m in (Payment, Invoice, SubscriptionLine, Subscription, QuotationTemplateLine, QuotationTemplate, Discount, ProductVariant,
                  Product, RecurringPlan, Tax, AuditEvent, BillingRun, Sequence, PasswordResetToken):
            m.objects.all().delete()
        User.objects.all().delete()
        Customer.objects.all().delete()

    def catalog(self, on):
        self.taxes = [Tax.objects.create(name=n, rate=r, type=t) for n, r, t in
                      [('GST 18%', 18, 'GST'), ('GST 12%', 12, 'GST'), ('GST 5%', 5, 'GST'), ('Exempt', 0, 'Exempt')]]
        gst = self.taxes[0]
        self.products = [Product.objects.create(name=n, type=t, sales_price=P(s), cost_price=P(c), notes=x, tax=gst) for n, t, s, c, x in [
            ('Analytics Pro', 'Software', 799, 210, 'Advanced dashboards and exports'),
            ('Cloud Storage', 'Service', 299, 90, 'Secure file storage'),
            ('Priority Support', 'Service', 999, 400, '4-hour response SLA'),
            ('ERP Connector', 'Add-on', 1200, 350, 'Sync invoices with your ERP'),
            ('Extra Workspace', 'Add-on', 450, 60, 'Additional team workspace'),
            ('Onboarding & Training', 'Service', 2500, 1100, 'Live training sessions')]]
        storage, connector = self.products[1], self.products[3]
        for prod, attr, value, extra in [(storage, 'Size', '100 GB', 0), (storage, 'Size', '500 GB', 400), (storage, 'Size', '1 TB', 900),
                                         (connector, 'Brand', 'Odoo', 560), (connector, 'Brand', 'Zoho', 300), (connector, 'Brand', 'Tally', 250)]:
            ProductVariant.objects.create(product=prod, attribute=attr, value=value, extra_price=P(extra))
        y = on.year
        self.plans = [RecurringPlan.objects.create(
            name=n, period=per, price=P(pr), min_qty=mq, closable=cl, pausable=pa, renewable=re, auto_close=ac, tax=gst,
            start_date=on.replace(year=y - 2, month=1, day=1), end_date=on.replace(month=12, day=31) if n == 'Event Day Pass' else None,
        ) for n, per, pr, mq, cl, pa, re, ac in [
            ('Starter', 'MONTHLY', 499, 1, True, True, True, True), ('Business', 'MONTHLY', 1299, 5, True, True, True, False),
            ('Enterprise', 'YEARLY', 12999, 10, False, False, True, False), ('Flex Weekly', 'WEEKLY', 199, 1, True, True, False, True),
            ('Event Day Pass', 'DAILY', 49, 1, True, False, False, True)]]
        d = timedelta
        Discount.objects.create(name='Volume 10+ seats', kind='PERCENT', value=10, min_qty=10, start_date=on.replace(year=y - 1, month=1, day=1), end_date=on.replace(year=y + 1, month=12, day=31))
        Discount.objects.create(name='Diwali Offer', kind='FIXED', value=P(500), min_amount=P(3000), start_date=on - d(20), end_date=on + d(12), usage_limit=150)
        Discount.objects.create(name='Connector Launch 15%', kind='PERCENT', value=15, scope='PRODUCT', product=connector, start_date=on - d(90), end_date=on + d(60), usage_limit=120)
        Discount.objects.create(name='Monsoon Sale', kind='PERCENT', value=8, min_amount=P(1000), start_date=on - d(150), end_date=on - d(60))
        odoo = ProductVariant.objects.get(value='Odoo')
        gb500 = ProductVariant.objects.get(value='500 GB')
        for name, plan, qty, valid, terms, months, lines, notes in [
            ('Business Standard', self.plans[1], 5, 15, 15, 12, [(self.products[0], None, 1), (self.products[2], None, 1)], 'Most popular for growing teams'),
            ('Enterprise Annual', self.plans[2], 25, 30, 30, 24, [(connector, odoo, 1), (storage, gb500, 2)], 'Includes ERP connector (Odoo brand)'),
            ('Starter Self-Serve', self.plans[0], 1, 7, 0, 12, [], 'For small shops')]:
            t = QuotationTemplate.objects.create(name=name, plan=plan, qty=qty, validity_days=valid, payment_terms_days=terms, duration_months=months, notes=notes)
            for prod, var, q in lines:
                QuotationTemplateLine.objects.create(template=t, product=prod, variant=var, qty=q)

    def people(self, rnd):
        self.customers = []
        for i, name in enumerate(CUSTOMERS):
            city, state = PLACES[0] if i == 0 else rnd.choice(PLACES)
            slug = ''.join(ch for ch in name.lower() if ch.isalpha())
            self.customers.append(Customer.objects.create(
                name=name, email='customer@subsync.in' if i == 0 else f'accounts@{slug}.in',
                phone=f'+91 9{rnd.randint(0, 999999999):09d}', city=city, state=state))
        User.objects.create_user('admin@subsync.in', 'Admin@12345', name='Ann Rose', role='ADMIN', is_staff=True, is_superuser=True)
        User.objects.create_user('staff@subsync.in', 'Staff@12345', name='Rahul Menon', role='STAFF')
        User.objects.create_user('customer@subsync.in', 'Customer@123', name='Meera Nair', role='CUSTOMER', customer=self.customers[0])

    def subscriptions(self, rnd, on, count):
        yesterday = on - timedelta(days=1)
        plans = [p for p in self.plans if p.period != 'DAILY']
        events = []

        def at(d, h):
            return timezone.make_aware(datetime.combine(d, time(h)))

        for i in range(count):
            plan = rnd.choice(plans)
            start = on - timedelta(days=rnd.randint(5, 424))
            expiry = (add_months_anchored(start, 24, start.day) if plan.period == 'YEARLY' else start + timedelta(weeks=26)
                      if plan.period == 'WEEKLY' else add_months_anchored(start, 12 + rnd.randint(0, 11), start.day))
            r = rnd.random()
            state = 'ACTIVE' if i < 3 or r >= 0.15 else ('PAUSED' if r < 0.07 else 'CLOSED')
            with transaction.atomic():
                seq, _ = Sequence.objects.get_or_create(code='SUB')
                sub = Subscription.objects.create(
                    number=f'SUB-{seq.next_value:05d}', customer=self.customers[0] if i < 3 else rnd.choice(self.customers), plan=plan,
                    qty=max(plan.min_qty, rnd.randint(1, 12)), state='ACTIVE', start_date=start, expiry_date=expiry, next_billing_date=start,
                    anchor_day=start.day, payment_terms_days=rnd.choice([0, 7, 15, 15, 30]), activated_on=start, created_at=start)
                Sequence.objects.filter(code='SUB').update(next_value=seq.next_value + 1)
                for prod in rnd.sample(self.products, rnd.randint(0, 2)):
                    variants = list(prod.variants.all())
                    var = rnd.choice(variants) if variants and rnd.random() < 0.6 else None
                    SubscriptionLine.objects.create(subscription=sub, product=prod, variant=var, qty=rnd.randint(1, 3),
                                                    unit_price=prod.sales_price + (var.extra_price if var else 0), tax=prod.tax)
            stop = yesterday
            if state == 'PAUSED':
                sub.paused_on = on - timedelta(days=rnd.randint(3, 42))
                stop = sub.paused_on - timedelta(days=1)
            if state == 'CLOSED':
                sub.closed_on = on - timedelta(days=rnd.randint(5, 124))
                sub.close_reason = 'Closed by customer'
                stop = sub.closed_on - timedelta(days=1)
            if state == 'ACTIVE' and i % 37 == 5:
                stop = on - timedelta(days=40)  # a missed billing period, shown as revenue leakage
            if state == 'ACTIVE' and expiry < on:
                sub.expiry_date = add_months_anchored(expiry, 12, sub.anchor_day)  # renewed
            bill_subscription(sub, min(stop, sub.expiry_date))
            sub.state = state
            sub.save()
            events.append(AuditEvent(entity='subscription', entity_id=sub.id, action='Created as Draft', detail=sub.number, actor='Rahul Menon', at=at(start - timedelta(days=3), 11)))
            events.append(AuditEvent(entity='subscription', entity_id=sub.id, action='Quotation sent', actor='Rahul Menon', at=at(start - timedelta(days=2), 12)))
            events.append(AuditEvent(entity='subscription', entity_id=sub.id, action='Activated', detail=f'Billing from {start}', actor='Rahul Menon', at=at(start, 9)))
            if sub.paused_on:
                events.append(AuditEvent(entity='subscription', entity_id=sub.id, action='Paused', actor='Ann Rose', at=at(sub.paused_on, 15)))
            if sub.closed_on:
                events.append(AuditEvent(entity='subscription', entity_id=sub.id, action='Closed', detail=sub.close_reason, actor='Ann Rose', at=at(sub.closed_on, 16)))

        # Renewals due soon
        for k, sub in enumerate(Subscription.objects.filter(state='ACTIVE').order_by('id')[5:14]):
            sub.expiry_date = on + timedelta(days=4 + k * 3)
            sub.save(update_fields=['expiry_date'])

        # Quotation pipeline
        templates = list(QuotationTemplate.objects.select_related('plan').prefetch_related('lines__product', 'lines__variant'))
        for cust_idx, state, t_idx in [(1, 'DRAFT', 1), (4, 'QUOTATION', 0), (7, 'QUOTATION', 1), (10, 'CONFIRMED', 1), (13, 'DRAFT', 2), (16, 'QUOTATION', 2)]:
            t = templates[t_idx]
            start = on + timedelta(days=3)
            seq = Sequence.objects.get(code='SUB')
            sub = Subscription.objects.create(
                number=f'SUB-{seq.next_value:05d}', customer=self.customers[cust_idx], plan=t.plan, template=t, qty=max(t.qty, t.plan.min_qty),
                state=state, start_date=start, expiry_date=add_months_anchored(start, t.duration_months, start.day), anchor_day=start.day,
                payment_terms_days=t.payment_terms_days, valid_until=on + timedelta(days=2 if cust_idx == 4 else 10) if state == 'QUOTATION' else None)
            Sequence.objects.filter(code='SUB').update(next_value=seq.next_value + 1)
            for l in t.lines.all():
                SubscriptionLine.objects.create(subscription=sub, product=l.product, variant=l.variant, qty=l.qty,
                                                unit_price=l.product.sales_price + (l.variant.extra_price if l.variant else 0), tax=l.product.tax)

        # Confirm history (gap-free numbers in date order); leave the newest few as drafts
        admin = User.objects.get(email='admin@subsync.in')
        cut = on - timedelta(days=3)
        ids = [i for i, d in Invoice.objects.values_list('id', 'invoice_date') if d < cut or rnd.random() < 0.5]
        confirm_invoices(ids, admin)

        # Payments
        payments = []
        for inv in Invoice.objects.filter(state='CONFIRMED').order_by('invoice_date', 'id'):
            late = (on - inv.due_date).days
            r = rnd.random()
            share = 1 if late > 120 else (1 if r < 0.94 else 0.5 if r < 0.97 else 0) if late > 30 else (1 if r < 0.72 else 0.4 if r < 0.82 else 0) if late > 0 else (1 if r < 0.45 else 0)
            if not share:
                continue
            amount = inv.total if share == 1 else round(inv.total * share)
            window = max(1, (inv.due_date - inv.invoice_date).days + 6)
            paid_on = min(on, inv.invoice_date + timedelta(days=rnd.randint(0, window)))
            payments.append(Payment(invoice=inv, customer_id=inv.customer_id, method=rnd.choice(['UPI', 'UPI', 'UPI', 'BANK', 'BANK', 'CARD', 'CASH']),
                                    amount=amount, paid_on=paid_on, note='' if share == 1 else 'Part payment', recorded_by='Rahul Menon'))
            inv.amount_paid = amount
            inv.state = 'PAID' if amount == inv.total else 'PARTIAL'
            inv.save(update_fields=['amount_paid', 'state'])
        Payment.objects.bulk_create(payments)
        AuditEvent.objects.bulk_create(events)
        AuditEvent.objects.create(action='Demo data loaded', entity='system', detail=f'{Subscription.objects.count()} subscriptions, {Invoice.objects.count()} invoices')
