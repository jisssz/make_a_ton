from django.db.models import Q

PAGE_SIZE = 25


def page_of(request):
    try:
        return max(1, int(request.query_params.get('page', 1)))
    except ValueError:
        return 1


def paginate(qs, request, serialize, size=PAGE_SIZE):
    """Server-side pagination: never sends thousands of rows to the browser."""
    page = page_of(request)
    total = qs.count() if hasattr(qs, 'count') and not isinstance(qs, list) else len(qs)
    rows = qs[(page - 1) * size: page * size]
    return {'rows': [serialize(r) for r in rows], 'total': total, 'page': page, 'size': size}


def search(qs, q, *fields):
    if not q:
        return qs
    cond = Q()
    for f in fields:
        cond |= Q(**{f'{f}__icontains': q})
    return qs.filter(cond)
