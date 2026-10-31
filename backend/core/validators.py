import re

from django.core.exceptions import ValidationError

PASSWORD_RULES = [
    (lambda p: len(p) > 8, 'More than 8 characters'),
    (lambda p: re.search(r'[A-Z]', p), 'One uppercase letter'),
    (lambda p: re.search(r'[a-z]', p), 'One lowercase letter'),
    (lambda p: re.search(r'[^A-Za-z0-9]', p), 'One special character'),
]
EMAIL_RE = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')


def password_problems(password):
    password = password or ''
    return [msg for rule, msg in PASSWORD_RULES if not rule(password)]


class BrightloopPasswordValidator:
    """Problem statement rule: more than 8 characters with upper, lower and special characters."""

    def validate(self, password, user=None):
        problems = password_problems(password)
        if problems:
            raise ValidationError('Password needs: ' + ', '.join(problems).lower())

    def get_help_text(self):
        return 'More than 8 characters, with an uppercase letter, a lowercase letter and a special character.'
