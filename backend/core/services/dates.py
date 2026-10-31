"""Billing-date maths. All dates are IST calendar dates."""
import calendar
from datetime import date, timedelta

from django.conf import settings
from django.utils import timezone

MONTHLY_FACTOR = {'DAILY': 365 / 12, 'WEEKLY': 52 / 12, 'MONTHLY': 1, 'YEARLY': 1 / 12}


def today():
    return timezone.localdate()


def parse(value):
    if value in (None, ''):
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def iso(d):
    return d.isoformat() if d else None


def add_months_anchored(d, months, anchor_day):
    """Month-end safe: always computed from the anchor day, so the 31st never drifts.
    Jan 31 -> Feb 28/29 -> Mar 31 -> Apr 30."""
    m = d.month - 1 + months
    year, month = d.year + m // 12, m % 12 + 1
    day = min(anchor_day or d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def next_period_start(d, period, anchor_day):
    if period == 'DAILY':
        return d + timedelta(days=1)
    if period == 'WEEKLY':
        return d + timedelta(days=7)
    if period == 'MONTHLY':
        return add_months_anchored(d, 1, anchor_day)
    if period == 'YEARLY':
        return add_months_anchored(d, 12, anchor_day)
    raise ValueError(f'Unknown period {period}')


def company():
    return settings.COMPANY
