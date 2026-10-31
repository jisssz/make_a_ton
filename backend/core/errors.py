"""All API errors use one shape: {"detail": "...", "fields": {"field": "message"}}."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_handler


class AppError(Exception):
    """A business-rule or validation error shown to the user."""

    def __init__(self, message, fields=None, code=status.HTTP_400_BAD_REQUEST):
        super().__init__(message)
        self.message = message
        self.fields = fields or {}
        self.code = code


class NotFound(AppError):
    def __init__(self, what='Record'):
        super().__init__(f'{what} not found', code=status.HTTP_404_NOT_FOUND)


class Forbidden(AppError):
    def __init__(self, message='You do not have permission to do this'):
        super().__init__(message, code=status.HTTP_403_FORBIDDEN)


def check_fields(fields):
    if fields:
        raise AppError('Please fix the highlighted fields', fields)


def exception_handler(exc, context):
    if isinstance(exc, AppError):
        body = {'detail': exc.message}
        if exc.fields:
            body['fields'] = exc.fields
        return Response(body, status=exc.code)
    response = drf_handler(exc, context)
    if response is not None and isinstance(response.data, dict) and 'detail' not in response.data:
        response.data = {'detail': 'Invalid request', 'fields': response.data}
    return response
