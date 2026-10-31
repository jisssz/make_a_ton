# SubSync REST API Specification

**Project:** SubSync – Intelligent Subscription & Revenue Management Platform  
**Team:** NPSKY (Jis Shajan, Ann Rose, Jovial)  
**Hackathon:** Odoo x Make-A-Ton 9.0 Kochi Hackathon 2026  
**Base URL:** `http://127.0.0.1:8000/api`

---

## 1. Authentication & Session Management

All authenticated endpoints require standard Bearer token authorization:
`Authorization: Bearer <jwt_access_token>`

### 1.1 Sign In
- **Endpoint:** `POST /api/auth/login/`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "admin@subsync.in",
    "password": "Admin@12345"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "admin@subsync.in",
      "name": "Ann Rose",
      "role": "ADMIN",
      "customerId": null
    }
  }
  ```

### 1.2 Customer Sign Up
- **Endpoint:** `POST /api/auth/signup/`
- **Access:** Public
- **Enforcement:** Password must be $>8$ chars with uppercase, lowercase, number, and special character.
- **Request Body:**
  ```json
  {
    "name": "Rahul Menon",
    "company": "Kochi Cloudworks",
    "email": "rahul@kochicloud.in",
    "password": "SecurePassword@123",
    "confirm": "SecurePassword@123"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": 14,
      "email": "rahul@kochicloud.in",
      "name": "Rahul Menon",
      "role": "CUSTOMER",
      "customerId": 85
    }
  }
  ```

### 1.3 Authenticated User Profile
- **Endpoint:** `GET /api/auth/me/`
- **Access:** Signed-in

### 1.4 Forgot Password
- **Endpoint:** `POST /api/auth/forgot/`
- **Access:** Public
- **Request Body:** `{"email": "customer@subsync.in"}`
- **Response (200 OK):** Single-use reset link generated (expires in 30 minutes).

### 1.5 Password Reset
- **Endpoint:** `POST /api/auth/reset/`
- **Access:** Public
- **Request Body:** `{"token": "<hashed_token>", "password": "NewSecurePassword@123"}`

---

## 2. Catalog & System Lookups

### 2.1 System Lookups
- **Endpoint:** `GET /api/lookups/`
- **Access:** Signed-in
- **Returns:** Active products, variants, recurring plans, taxes (CGST/SGST/IGST), active discounts, and customers list.

### 2.2 Products
- **Endpoint:** `GET, POST /api/products/`
- **Access:** Admin / Staff
- **Request Body (POST):**
  ```json
  {
    "name": "Enterprise Security Suite",
    "salesPrice": 500000,
    "costPrice": 200000,
    "taxId": 9
  }
  ```
  *(Note: All monetary amounts are in integer paise: ₹5,000.00 = 500000 paise)*

### 2.3 Recurring Plans
- **Endpoint:** `GET, POST /api/plans/`
- **Access:** Admin / Staff
- **Request Body (POST):**
  ```json
  {
    "name": "Cloud Security Monthly",
    "period": "MONTHLY",
    "price": 500000,
    "taxId": 9,
    "minQty": 1,
    "renewable": true,
    "pausable": true,
    "autoClose": false
  }
  ```

---

## 3. Customer Directory

### 3.1 List / Create Customers
- **Endpoint:** `GET, POST /api/customers/`
- **Access:** Admin / Staff
- **Request Body (POST):**
  ```json
  {
    "name": "Zenith Technologies",
    "email": "billing@zenithtech.in",
    "phone": "+91 98765 00000",
    "city": "Kochi",
    "state": "Kerala",
    "address": "Infopark Phase 2",
    "gstin": "32AABCB1234A1Z5"
  }
  ```

### 3.2 Customer Detail
- **Endpoint:** `GET, PUT /api/customers/{id}/`
- **Access:** Admin / Staff (or Customer if requesting their own record)

---

## 4. Quotations & Subscriptions

### 4.1 Create Quotation / Subscription
- **Endpoint:** `POST /api/subscriptions/`
- **Access:** Staff / Admin
- **Request Body:**
  ```json
  {
    "customerId": 100,
    "planId": 22,
    "qty": 2,
    "startDate": "2026-10-31",
    "state": "QUOTATION",
    "lines": []
  }
  ```
- **Response (201 Created):**
  Returns subscription object (`SUB-00267`), anchor day, payment terms, and normalized MRR.

### 4.2 Lifecycle Transitions (State Machine)
- **Endpoint:** `POST /api/subscriptions/{id}/transition/`
- **Access:** Staff / Admin
- **Request Body:**
  ```json
  {
    "action": "send"
  }
  ```
  *Allowed actions:*
  - `send`: Moves `DRAFT` $\rightarrow$ `QUOTATION` (sets 15-day validity date).
  - `confirm`: Moves `QUOTATION` $\rightarrow$ `CONFIRMED` (locks pricing).
  - `activate`: Moves `CONFIRMED` $\rightarrow$ `ACTIVE` (anchors `next_billing_date`).
  - `pause`: Moves `ACTIVE` $\rightarrow$ `PAUSED` (halts billing without inflating churn).
  - `resume`: Moves `PAUSED` $\rightarrow$ `ACTIVE` (resumes billing schedule).
  - `close`: Moves `ACTIVE` or `PAUSED` $\rightarrow$ `CLOSED` (records close reason).

---

## 5. Automated Billing Engine

### 5.1 Trigger Billing Run
- **Endpoint:** `POST /api/billing/run/`
- **Access:** Staff / Admin
- **Request Body (Optional):**
  ```json
  {
    "upTo": "2026-11-30"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "id": 42,
    "runDate": "2026-10-31",
    "invoicesCreated": 10,
    "duplicatesSkipped": 0,
    "autoClosed": 0,
    "durationMs": 121
  }
  ```
- **Integrity Guarantee:** Enforced by database `UniqueConstraint(subscription, period_start)`. Immediate re-runs return `invoicesCreated: 0`.

### 5.2 Historical Billing Run Logs
- **Endpoint:** `GET /api/billing/runs/`
- **Access:** Staff / Admin

---

## 6. Invoices & Taxes

### 6.1 List Invoices
- **Endpoint:** `GET /api/invoices/?state=CONFIRMED&q=Zenith`
- **Access:** Staff / Admin (Customers see only their own invoices)

### 6.2 Invoice Detail
- **Endpoint:** `GET /api/invoices/{id}/`
- **Access:** Staff / Admin (or invoice owner)
- **Includes:** Subtotal, discount deduction, itemized GST split (`cgst`, `sgst`, `igst`), total, amount paid, balance, and payment history.

### 6.3 Batch Confirm Invoices
- **Endpoint:** `POST /api/invoices/confirm/`
- **Access:** Staff / Admin
- **Request Body:**
  ```json
  {
    "ids": [11170]
  }
  ```
  *(or `{"all": true}` to confirm all pending draft invoices)*
- **Response:** Transitions invoice `DRAFT` $\rightarrow$ `CONFIRMED` and allocates official sequential number `INV/2026/02524`.

---

## 7. Payments & Reconciliation

### 7.1 Record Payment
- **Endpoint:** `POST /api/payments/`
- **Access:** Staff / Admin
- **Request Body:**
  ```json
  {
    "invoiceId": 11170,
    "method": "UPI",
    "amount": 500000,
    "paidOn": "2026-10-31",
    "note": "Instant Bharat UPI settlement via Google Pay (Ref UPI/2026/84920194)"
  }
  ```
- **Behavior:**
  - If `amount < balance`: invoice state updates to `PARTIAL`.
  - If `amount == balance`: invoice state updates to `PAID`.
  - If `amount > balance`: rejected with HTTP 400 (Overpayment prohibited).

---

## 8. Financial Analytics & Predictive Forecasting

### 8.1 Executive Dashboard & Forecasting
- **Endpoint:** `GET /api/reports/dashboard/`
- **Access:** Staff / Admin
- **Response Structure:**
  ```json
  {
    "summary": {
      "activeSubs": 224,
      "mrr": 269013171,
      "arr": 3228158052,
      "cashCollected": 2641158944,
      "billed": 2861318963,
      "outstanding": 220159981,
      "overdue": 155356642
    },
    "aging": {
      "current": 64803339,
      "d30": 131548540,
      "d60": 15000000,
      "d90": 5500000,
      "d90p": 3308102
    },
    "leakage": {
      "atRisk": 13819099,
      "items": [
        {"key": "missed", "label": "Active subscriptions with missed billing", "count": 0, "value": 0},
        {"key": "dup", "label": "Duplicate invoices for the same period", "count": 0, "value": 0},
        {"key": "old", "label": "Invoices overdue for more than 60 days", "count": 3, "value": 13819099}
      ]
    },
    "forecast": {
      "collection_efficiency_pct": 92.3,
      "projections": [
        {
          "horizon_days": 30,
          "horizon_label": "Next 30 Days (1 Month)",
          "cycles_modeled": 340,
          "expected_billings": 274546900,
          "expected_cash_collections": 253422289
        },
        {
          "horizon_days": 60,
          "horizon_label": "Next 60 Days (2 Months)",
          "cycles_modeled": 296,
          "expected_billings": 220611000,
          "expected_cash_collections": 203636408
        },
        {
          "horizon_days": 90,
          "horizon_label": "Next 90 Days (Quarterly)",
          "cycles_modeled": 271,
          "expected_billings": 214033100,
          "expected_cash_collections": 197564635
        }
      ]
    }
  }
  ```
