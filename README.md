# SubSync — Subscription Management System

One platform for **Brightloop Software** to run plans, subscriptions and recurring billing:
products & variants → recurring plans → quotation templates → subscriptions → automatic invoices (GST, discounts) → payments → finance dashboard.

Built for **Odoo x Make-a-ton 9.0** (31 Oct 2026).

| Part | Stack |
|------|-------|
| `frontend/` | React 18 + Vite + Tailwind CSS + React Router + Recharts |
| `backend/` | Django 5 + Django REST Framework + SimpleJWT, SQLite (PostgreSQL-ready) |

---

## Quick start

**1. Backend** (terminal 1)
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
python manage.py migrate
python manage.py seed           # demo data: ~260 subscriptions, ~2,800 invoices, payments
python manage.py runserver      # http://127.0.0.1:8000
```

**2. Frontend** (terminal 2)
```bash
cd frontend
npm install
copy .env.example .env          # macOS/Linux: cp .env.example .env
# set VITE_USE_API=true in .env to use the Django backend
npm run dev                     # http://localhost:5173
```

> With `VITE_USE_API=false` the frontend runs on its own with built-in demo data (useful if the backend is down during a demo).

### Logins (after `seed`)

| Role     | Email               | Password     |
|----------|---------------------|--------------|
| Admin    | admin@subsync.in    | Admin@12345  |
| Staff    | staff@subsync.in    | Staff@12345  |
| Customer | customer@subsync.in | Customer@123 |

Django admin: http://127.0.0.1:8000/admin (admin login above).

---

## Workflow

```
Sign up / log in ──► role (Admin · Staff · Customer)
Admin:  Products & variants ─► Recurring plans ─► Taxes ─► Discount rules ─► Add staff
Staff:  Quotation template ─► Subscription  Draft → Quotation → Confirmed → Active (→ Paused) → Closed
Billing run (button or daily cron):
        for every Active subscription with next billing date ≤ today
          plan + products → best discount → GST (CGST/SGST or IGST) → invoice (Draft)
          UNIQUE(subscription, period) → never billed twice; catch-up loop → never skipped
Invoice: Draft → Confirmed (numbered INV/2026/00001) → Partially paid → Paid  (or Cancelled)
Payments recorded against invoices; overdue = past due date with balance
Dashboard: active subs, MRR/ARR, billed vs collected, outstanding, overdue, aging,
           Billing Control Centre (next actions) + revenue-leakage checks
Customer portal: own subscriptions & invoices only; pause/close/renew if the plan allows
```

## Key engineering decisions

- **No double billing** — database `UniqueConstraint(subscription, period_start)`; each invoice is written with its lines and the subscription's next billing date in one transaction.
- **No skipped periods** — catch-up loop bills every overdue period in date order.
- **Month-end safe** — anchored date maths (Jan 31 → Feb 28/29 → Mar 31).
- **Money in integer paise**, Decimal rounding half-up; discount applied **before** tax; one (best) discount per invoice; usage limits counted in the same transaction.
- **Invoice line snapshots** — later price changes never rewrite history; invoices are cancelled, never deleted.
- **Gap-free numbering** from a `Sequence` table inside transactions.
- **Security** — PBKDF2-hashed passwords, rule: >8 chars + upper + lower + special; one account per email; reset tokens stored hashed, single-use, 30-minute expiry, same reply whether the email exists; JWT auth; role checks and customer data isolation in every endpoint; login throttling.
- **Performance** — indexed queries, server-side pagination (25 rows), dashboard built from aggregate queries (~50 ms on demo data). Every page shows/feeds a response-time badge.

## Useful commands

```bash
python manage.py run_billing               # bill everything due today (schedule daily at 06:00 IST)
python manage.py run_billing --date 2027-01-31
python manage.py seed --fresh              # reload demo data
python manage.py test core                 # billing + access tests
```

## Project layout

```
backend/
  core/models.py              data model (customers, catalog, subscriptions, invoices, payments, audit)
  core/services/pricing.py    discount → GST → totals
  core/services/billing.py    billing engine, invoices, payments
  core/services/lifecycle.py  subscription states and actions
  core/services/reports.py    dashboard, control centre, leakage checks
  core/views/                 REST endpoints (auth, catalog, subscriptions, billing)
  core/management/commands/   seed, run_billing
  core/tests.py
frontend/
  src/data/api.js             one data layer for every screen (REST or demo)
  src/pages/                  landing, auth, app/*, portal/*
  src/components/             app shell, UI kit, shared tables
```

## Team ownership (one file area each, commit hourly to `main`)

| Area | Backend | Frontend |
|------|---------|----------|
| Auth & users | `views/auth.py`, users in `views/billing.py` | `pages/auth`, `pages/app/Users.jsx` |
| Catalog | `views/catalog.py` | `pages/app/Catalog.jsx`, `Quotations.jsx`, `Customers.jsx` |
| Subscriptions & billing | `services/lifecycle.py`, `services/billing.py`, `views/subscriptions.py` | `Subscription*.jsx`, `BillingRun.jsx`, `Invoice*.jsx` |
| Payments & reports | `services/reports.py` | `Dashboard.jsx`, `Payments.jsx`, `pages/portal` |
