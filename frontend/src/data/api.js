/**
 * Single data-access layer for every screen.
 *
 *  - Default (demo) mode: calls the in-browser store (src/data/store.js), which applies
 *    the same business rules as the backend, so the whole UI works standalone.
 *  - Backend mode: set VITE_USE_API=true in .env and every call goes to the Django REST API
 *    (endpoints listed next to each function). Response shapes are the same in both modes.
 */
import * as S from './store';
import { addDays } from '../lib/dates';

const USE_API = import.meta.env.VITE_USE_API === 'true';
const SESSION_KEY = 'subsync-session';

/* ------------------------------ session ------------------------------ */
let session = null;
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; }
export const getUser = () => session?.user || null;
function setSession(s) {
  session = s;
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

/* ------------------------------ transport ---------------------------- */
async function http(method, path, body, params) {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null))}` : '';
  const res = await fetch(`${path}${qs}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401 && session?.token && !path.startsWith('/api/auth/')) { setSession(null); window.location.assign('/login'); }
  if (!res.ok) throw new S.AppError(data?.detail || 'Something went wrong', data?.fields);
  if (method !== 'GET') setTimeout(notifyChange, 0); // screens reload after any change
  return data;
}

/* Change notifications so open screens refresh after a save (demo store emits its own). */
const apiListeners = new Set();
function notifyChange() { apiListeners.forEach((fn) => fn()); }

const run = (fn) => new Promise((resolve, reject) => {
  try { S.load(); resolve(fn()); } catch (e) { reject(e); }
});
const actor = () => getUser();

/* ------------------------------ helpers ------------------------------ */
const paginate = (rows, page = 1, size = 25) => ({ rows: rows.slice((page - 1) * size, page * size), total: rows.length, page, size });
const match = (q, ...vals) => !q || vals.some((v) => String(v || '').toLowerCase().includes(q.toLowerCase()));

function invoiceRow(inv, L) {
  const sub = S.getDb().subscriptions.find((s) => s.id === inv.subscriptionId);
  return {
    ...inv, customer: L.customers[inv.customerId]?.name, subscriptionNumber: sub?.number,
    balance: S.invoiceBalance(inv), overdue: S.isOverdue(inv),
    daysOverdue: S.isOverdue(inv) ? Math.max(0, Math.round((new Date(S.today()) - new Date(inv.dueDate)) / 86400000)) : 0,
  };
}
function subRow(s, L) {
  const plan = L.plans[s.planId];
  return { ...s, customer: L.customers[s.customerId]?.name, plan: plan?.name, period: plan?.period, mrr: S.subMRR(s) };
}

/* ================================ API ================================= */
export const api = {
  /* Auth — POST /api/auth/login/, /api/auth/signup/, /api/auth/forgot/, /api/auth/reset/ */
  async login(email, password) {
    const r = USE_API ? await http('POST', '/api/auth/login/', { email, password }) : await run(() => ({ user: S.login(email, password), token: 'demo' }));
    setSession(r);
    return r.user;
  },
  async signup(data) {
    const r = USE_API ? await http('POST', '/api/auth/signup/', data) : await run(() => ({ user: S.signup(data), token: 'demo' }));
    setSession(r);
    return r.user;
  },
  logout() { setSession(null); },
  forgotPassword: (email) => (USE_API ? http('POST', '/api/auth/forgot/', { email }) : run(() => ({ devLink: S.requestPasswordReset(email) }))),
  resetPassword: (token, password) => (USE_API ? http('POST', '/api/auth/reset/', { token, password }) : run(() => S.resetPassword(token, password))),

  /* Reference data for forms — GET /api/lookups/ */
  lookups: () => (USE_API ? http('GET', '/api/lookups/') : run(() => {
    const db = S.getDb();
    return {
      customers: db.customers, plans: db.plans, products: db.products, variants: db.variants,
      taxes: db.taxes, discounts: db.discounts, templates: db.templates, company: S.COMPANY,
    };
  })),

  /* Dashboard — GET /api/reports/summary/, /trends/, /aging/, /control-centre/, /leakage/ */
  dashboard: (filters = {}) => (USE_API ? http('GET', '/api/reports/dashboard/', null, filters) : run(() => {
    const t0 = performance.now();
    const L = S.lookups();
    const cc = S.controlCentre();
    const out = {
      summary: S.summary(filters), trends: S.trends(12), aging: S.agingBuckets(), leakage: S.leakage(),
      control: {
        renewals: cc.renewals.slice(0, 6).map((s) => subRow(s, L)), renewalsCount: cc.renewals.length,
        dueToday: cc.dueToday.length, dueValue: cc.dueToday.reduce((a, s) => a + S.subMRR(s), 0),
        expiringQuotes: cc.expiringQuotes.map((s) => subRow(s, L)),
        drafts: cc.drafts.length, draftValue: cc.drafts.reduce((a, i) => a + i.total, 0),
        overdue: cc.overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6).map((i) => invoiceRow(i, L)),
        overdueCount: cc.overdue.length,
        discounts: cc.discounts,
      },
      activity: [...S.getDb().audit].sort((a, b) => b.at - a.at).slice(0, 8),
      planMix: S.getDb().plans.map((p) => ({ name: p.name, count: S.getDb().subscriptions.filter((s) => s.planId === p.id && s.state === 'ACTIVE').length })),
    };
    out.ms = Math.round(performance.now() - t0);
    return out;
  })),

  /* Customers — GET/POST /api/customers/ , GET /api/customers/:id/ */
  customers: (p = {}) => (USE_API ? http('GET', '/api/customers/', null, p) : run(() => {
    const db = S.getDb();
    const rows = db.customers.filter((c) => match(p.q, c.name, c.email, c.city)).map((c) => {
      const subs = db.subscriptions.filter((s) => s.customerId === c.id);
      const due = db.invoices.filter((i) => i.customerId === c.id && ['CONFIRMED', 'PARTIAL'].includes(i.state)).reduce((a, i) => a + S.invoiceBalance(i), 0);
      return { ...c, activeSubs: subs.filter((s) => s.state === 'ACTIVE').length, mrr: subs.filter((s) => s.state === 'ACTIVE').reduce((a, s) => a + S.subMRR(s), 0), outstanding: due };
    }).sort((a, b) => b.mrr - a.mrr);
    return paginate(rows, p.page);
  })),
  customer: (id) => (USE_API ? http('GET', `/api/customers/${id}/`) : run(() => {
    const db = S.getDb();
    const L = S.lookups();
    const c = db.customers.find((x) => x.id === Number(id));
    if (!c) throw new S.AppError('Customer not found');
    return {
      customer: c,
      subscriptions: db.subscriptions.filter((s) => s.customerId === c.id).map((s) => subRow(s, L)),
      invoices: db.invoices.filter((i) => i.customerId === c.id).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)).slice(0, 50).map((i) => invoiceRow(i, L)),
      payments: db.payments.filter((p) => p.customerId === c.id).slice(-20).reverse(),
    };
  })),
  saveCustomer: (data) => (USE_API ? http(data.id ? 'PUT' : 'POST', `/api/customers/${data.id ? `${data.id}/` : ''}`, data) : run(() => S.saveRow('customers', data, actor()))),

  /* Catalog — /api/products/, /api/plans/, /api/taxes/, /api/discounts/, /api/templates/ */
  saveRow: (coll, data) => (USE_API ? http(data.id ? 'PUT' : 'POST', `/api/${coll}/${data.id ? `${data.id}/` : ''}`, data) : run(() => S.saveRow(coll, data, actor()))),
  setVariants: (productId, variants) => (USE_API ? http('PUT', `/api/products/${productId}/variants/`, variants) : run(() => S.setVariants(productId, variants, actor()))),

  /* Subscriptions — GET/POST /api/subscriptions/, POST /api/subscriptions/:id/transition/ */
  subscriptions: (p = {}) => (USE_API ? http('GET', '/api/subscriptions/', null, p) : run(() => {
    const L = S.lookups();
    let rows = S.getDb().subscriptions;
    const user = actor();
    if (user?.role === 'CUSTOMER') rows = rows.filter((s) => s.customerId === user.customerId);
    if (p.state) rows = rows.filter((s) => s.state === p.state);
    if (p.planId) rows = rows.filter((s) => s.planId === Number(p.planId));
    if (p.expiring) { const on = S.today(); const to = addDays(on, 30); rows = rows.filter((s) => ['ACTIVE', 'PAUSED'].includes(s.state) && s.expiryDate && s.expiryDate >= on && s.expiryDate <= to); }
    rows = rows.filter((s) => match(p.q, s.number, L.customers[s.customerId]?.name)).map((s) => subRow(s, L))
      .sort((a, b) => b.id - a.id);
    const counts = S.getDb().subscriptions.reduce((acc, s) => ({ ...acc, [s.state]: (acc[s.state] || 0) + 1 }), {});
    return { ...paginate(rows, p.page), counts };
  })),
  subscription: (id) => (USE_API ? http('GET', `/api/subscriptions/${id}/`) : run(() => {
    const db = S.getDb();
    const L = S.lookups();
    const s = db.subscriptions.find((x) => x.id === Number(id));
    const user = actor();
    if (!s || (user?.role === 'CUSTOMER' && s.customerId !== user.customerId)) throw new S.AppError('Subscription not found');
    return {
      sub: subRow(s, L), plan: L.plans[s.planId], customer: L.customers[s.customerId],
      preview: S.priceSubscription(s, s.nextBillingDate || s.startDate),
      actions: S.allowedActions(s, L.plans[s.planId], user?.role),
      invoices: db.invoices.filter((i) => i.subscriptionId === s.id).sort((a, b) => b.periodStart.localeCompare(a.periodStart)).map((i) => invoiceRow(i, L)),
      events: db.audit.filter((e) => e.entity === 'subscription' && e.entityId === s.id).sort((a, b) => b.at - a.at),
      template: s.templateId ? db.templates.find((t) => t.id === s.templateId) : null,
    };
  })),
  draftFromTemplate: (templateId) => (USE_API ? http('GET', `/api/templates/${templateId}/draft/`) : run(() => S.draftFromTemplate(templateId))),
  saveSubscription: (data) => (USE_API ? http(data.id ? 'PUT' : 'POST', `/api/subscriptions/${data.id ? `${data.id}/` : ''}`, data) : run(() => S.saveSubscription(data, actor()))),
  transition: (id, action) => (USE_API ? http('POST', `/api/subscriptions/${id}/transition/`, { action }) : run(() => S.transition(id, action, actor()))),

  /* Invoices — GET /api/invoices/, POST /api/invoices/confirm/, /:id/cancel/, /:id/send/ */
  invoices: (p = {}) => (USE_API ? http('GET', '/api/invoices/', null, p) : run(() => {
    const L = S.lookups();
    let rows = S.getDb().invoices;
    const user = actor();
    if (user?.role === 'CUSTOMER') rows = rows.filter((i) => i.customerId === user.customerId && i.state !== 'DRAFT');
    if (p.filter === 'overdue') rows = rows.filter((i) => S.isOverdue(i));
    else if (p.filter === 'unpaid') rows = rows.filter((i) => ['CONFIRMED', 'PARTIAL'].includes(i.state));
    else if (p.filter) rows = rows.filter((i) => i.state === p.filter);
    if (p.from) rows = rows.filter((i) => i.invoiceDate >= p.from);
    if (p.to) rows = rows.filter((i) => i.invoiceDate <= p.to);
    rows = rows.filter((i) => match(p.q, i.number, L.customers[i.customerId]?.name))
      .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || b.id - a.id).map((i) => invoiceRow(i, L));
    const totals = rows.reduce((a, i) => ({ total: a.total + i.total, balance: a.balance + (['CONFIRMED', 'PARTIAL'].includes(i.state) ? i.balance : 0) }), { total: 0, balance: 0 });
    return { ...paginate(rows, p.page), totals };
  })),
  invoice: (id) => (USE_API ? http('GET', `/api/invoices/${id}/`) : run(() => {
    const db = S.getDb();
    const L = S.lookups();
    const inv = db.invoices.find((x) => x.id === Number(id));
    const user = actor();
    if (!inv || (user?.role === 'CUSTOMER' && (inv.customerId !== user.customerId || inv.state === 'DRAFT'))) throw new S.AppError('Invoice not found');
    return {
      invoice: invoiceRow(inv, L), customer: L.customers[inv.customerId], company: S.COMPANY,
      subscription: db.subscriptions.find((s) => s.id === inv.subscriptionId),
      payments: db.payments.filter((p) => p.invoiceId === inv.id),
      events: db.audit.filter((e) => e.entity === 'invoice' && e.entityId === inv.id),
    };
  })),
  confirmInvoices: (ids) => (USE_API ? http('POST', '/api/invoices/confirm/', { ids }) : run(() => S.confirmInvoices(ids, actor()))),
  confirmAllDrafts: () => (USE_API ? http('POST', '/api/invoices/confirm/', { all: true }) : run(() => S.confirmInvoices(S.getDb().invoices.filter((i) => i.state === 'DRAFT').map((i) => i.id), actor()))),
  cancelInvoice: (id) => (USE_API ? http('POST', `/api/invoices/${id}/cancel/`) : run(() => S.cancelInvoice(id, actor()))),
  sendInvoice: (id) => (USE_API ? http('POST', `/api/invoices/${id}/send/`) : run(() => S.sendInvoice(id, actor()))),

  /* Billing — POST /api/billing/run/, GET /api/billing/runs/ */
  runBilling: (upTo) => (USE_API ? http('POST', '/api/billing/run/', { upTo }) : run(() => S.runBilling(actor(), { upTo }))),
  billingRuns: () => (USE_API ? http('GET', '/api/billing/runs/') : run(() => {
    const db = S.getDb();
    const cc = S.controlCentre();
    return { runs: db.billingRuns.slice(0, 20), dueNow: cc.dueToday.length, drafts: cc.drafts.length, clock: S.getClock(), today: S.today() };
  })),
  setClock: (iso) => run(() => S.setClock(iso)), // demo only: simulate a future billing day

  /* Payments — GET/POST /api/payments/ */
  payments: (p = {}) => (USE_API ? http('GET', '/api/payments/', null, p) : run(() => {
    const db = S.getDb();
    const L = S.lookups();
    const invs = new Map(db.invoices.map((i) => [i.id, i]));
    let rows = db.payments;
    if (p.method) rows = rows.filter((x) => x.method === p.method);
    if (p.from) rows = rows.filter((x) => x.paidOn >= p.from);
    if (p.to) rows = rows.filter((x) => x.paidOn <= p.to);
    rows = rows.map((x) => ({ ...x, customer: L.customers[x.customerId]?.name, invoiceNumber: invs.get(x.invoiceId)?.number }))
      .filter((x) => match(p.q, x.invoiceNumber, x.customer, x.note)).reverse();
    const total = rows.reduce((a, x) => a + x.amount, 0);
    return { ...paginate(rows, p.page), totalAmount: total };
  })),
  recordPayment: (data) => (USE_API ? http('POST', '/api/payments/', data) : run(() => S.recordPayment(data, actor()))),

  /* Users (admin) — GET/POST /api/users/ */
  users: () => (USE_API ? http('GET', '/api/users/') : run(() => S.getDb().users.map(({ password, ...u }) => u))),
  addStaff: (data) => (USE_API ? http('POST', '/api/users/', data) : run(() => S.addStaff(data, actor()))),
  toggleUser: (id) => (USE_API ? http('POST', `/api/users/${id}/toggle/`) : run(() => S.toggleUser(id, actor()))),

  /* Demo tools */
  resetDemo: () => run(() => S.resetDemo()),
  generateBulk: (n) => run(() => S.generateBulk(n, actor())),
};

export const subscribeData = (fn) => {
  if (!USE_API) return S.subscribe(fn);
  apiListeners.add(fn);
  return () => apiListeners.delete(fn);
};
export const isDemoMode = !USE_API;
