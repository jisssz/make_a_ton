# SubSync — Frontend

Subscription management and recurring billing for **Brightloop Software** (Odoo x Make-a-ton 9.0).
React + Vite + Tailwind, styled with the *SubSync Enterprise Precision* design system (Inter + Kalam, plum `#714B67`).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

### Demo logins (built-in data)

| Role     | Email                 | Password       |
|----------|-----------------------|----------------|
| Admin    | admin@subsync.in      | Admin@12345    |
| Staff    | staff@subsync.in      | Staff@12345    |
| Customer | customer@subsync.in   | Customer@123   |

The login page has one-click buttons for these.

## Two data modes

| Mode | How | What happens |
|------|-----|--------------|
| **Demo** (default) | nothing to set | Runs on `src/data/store.js` — an in-browser store with the same business rules as the backend (billing engine, discounts, GST, payments). Seeds ~260 subscriptions and ~2,800 invoices. |
| **Backend** | copy `.env.example` to `.env`, set `VITE_USE_API=true`, run Django on `:8000` | Every call in `src/data/api.js` goes to the REST endpoint written next to it. Vite proxies `/api` to Django. |

All screens call only `src/data/api.js`, so wiring the backend never touches page code.

## Screens

| Path | Screen | Who |
|------|--------|-----|
| `/` | Landing page | Public |
| `/login`, `/signup`, `/forgot-password`, `/reset-password/:token` | Auth (password rules, unique email, reset link) | Public |
| `/app` | Overview — KPIs, **Billing Control Centre**, **revenue leakage check**, MRR trend, billed vs collected, aging, activity | Admin, Staff |
| `/app/customers` | Customers list + detail | Admin, Staff |
| `/app/quotations` | Quotation templates + pipeline (Draft → Sent → Confirmed) | Admin, Staff |
| `/app/subscriptions` | List, new/edit (from template), detail with status bar, actions, invoice preview, timeline | Admin, Staff |
| `/app/billing` | **Billing Run** — run, confirm drafts, simulate a future billing day, run history | Admin, Staff |
| `/app/invoices` | List, bulk confirm, printable GST tax invoice, send, cancel, record payment | Admin, Staff |
| `/app/payments` | All payments with filters | Admin, Staff |
| `/app/catalog` | Products & variants, recurring plans, taxes, discounts | Edit: Admin only |
| `/app/users` | Add staff, enable/disable users | Admin |
| `/app/settings` | Company info, performance test (add 1,000 / 5,000 subscriptions), reset demo | Admin |
| `/portal` | Customer portal — own subscriptions & invoices only, pause/close/renew if the plan allows | Customer |

## Business rules (same in demo store and backend)

- **No double billing** — one invoice per (subscription, billing period). Running billing again creates 0 invoices.
- **No skipped periods** — catch-up loop invoices every period up to the billing date.
- **Month-end safe dates** — anchored month maths: Jan 31 → Feb 28/29 → Mar 31.
- **Pricing order** — plan fee + product lines → best eligible discount (one per invoice) → GST → total. Lines are snapshotted on the invoice.
- **GST split** — customer in Kerala: CGST + SGST; other states: IGST.
- **Money** — integer paise, never floats. Indian number format (₹1,25,000.00).
- **Invoice states** — Draft → Confirmed → Partially paid → Paid, or Cancelled. Overdue is computed (due date passed, balance > 0). Numbers (`INV/2026/00001`) are assigned on confirm.
- **Subscription states** — Draft → Quotation → Confirmed → Active → Closed, plus Paused. Paused time shifts the next bill date.
- **Roles** — enforced in the data layer, not just hidden in the UI. Customers can only load their own records.

## Folder structure

```
src/
  data/api.js        ← the only data entry point for pages (demo or REST)
  data/store.js      ← demo store + billing engine + seed data
  lib/               ← dates, money format, validation, hooks (auth, toasts, queries)
  components/        ← AppShell (sidebar/header), ui kit, shared tables & payment modal
  pages/             ← Landing, auth, app/*, portal/*
```

## Backend endpoint contract

Listed beside each function in `src/data/api.js`. Main ones:

`POST /api/auth/login|signup|forgot|reset/` · `GET /api/lookups/` · `GET /api/reports/dashboard/` ·
`GET|POST /api/customers/` · `GET|POST|PUT /api/products|plans|taxes|discounts|templates/` ·
`GET|POST /api/subscriptions/` · `POST /api/subscriptions/:id/transition/ {action}` ·
`GET /api/invoices/` · `POST /api/invoices/confirm/` · `POST /api/invoices/:id/cancel|send/` ·
`POST /api/billing/run/` · `GET /api/billing/runs/` · `GET|POST /api/payments/` · `GET|POST /api/users/`

Errors should return `{ "detail": "message", "fields": { "field": "message" } }` so forms highlight the right inputs.
