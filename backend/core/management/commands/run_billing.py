"""python manage.py run_billing [--date YYYY-MM-DD]

Schedule daily (cron / Task Scheduler), e.g. 06:00 IST:
    0 6 * * *  cd /path/to/backend && python manage.py run_billing
Safe to run any number of times — already billed periods are skipped.
"""
from django.core.management.base import BaseCommand

from core.services.billing import run_billing


class Command(BaseCommand):
    help = 'Create invoices for every active subscription that is due'

    def add_arguments(self, parser):
        parser.add_argument('--date', help='Billing date (default: today in IST)')

    def handle(self, *args, date=None, **opts):
        run = run_billing(None, date)
        self.stdout.write(self.style.SUCCESS(
            f'{run.run_date}: {run.created} invoices created, {run.skipped} duplicates skipped, {run.closed} auto-closed ({run.duration_ms} ms)'))
