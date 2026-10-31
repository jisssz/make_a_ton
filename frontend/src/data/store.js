/**
 * SubSync in-browser data store.
 *
 * This mirrors the Django backend's business rules so the UI is fully
 * demo-able on its own. Set VITE_USE_API=true to use the real REST API instead
 * (see src/data/api.js). Money is integer paise; dates are YYYY-MM-DD (IST).
 */
import {
  addDays, diffDays, monthKey, monthlyFactor, nextPeriodStart, parseISO, todayIST, addMonthsAnchored,
} from '../lib/dates';
import { isStrongPassword, EMAIL_RE } from '../lib/validate';

export const COMPANY = { name: 'Brightloop Software', state: 'Kerala', gstin: '32ABCDE1234F1Z5', city: 'Thrissur' };
const STORAGE_KEY = 'subsync-demo-v1';

let db = null;
let listeners = new Set();
let clockOverride = null; // demo "time travel" for the billing run
let persistOff = false;

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => { listeners.forEach((fn) => fn()); persist(); };

export const today = () => clockOverride || todayIST();
export const setClock = (iso) => { clockOverride = iso || null; emit(); };
export const getClock = () => clockOverride;

class AppError extends Error {
  constructor(message, fields) { super(message); this.fields = fields; }
}
export { AppError };

/* ----------------------------- persistence ----------------------------- */
let persistTimer;
function persist() {
  if (persistOff) return;
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
    catch { persistOff = true; } // too large (bulk demo data) or storage blocked
  }, 300);
}

export function load() {
  if (db) return db;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) { db = JSON.parse(raw); return db; }
  } catch { /* ignore */ }
  db = seed();
  persist();
  return db;
}

export function resetDemo() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  persistOff = false;
  clockOverride = null;
  db = seed();
  emit();
}

export const getDb = () => load();

/* ------------------------------- helpers ------------------------------- */
const nextId = (coll) => (db.seq[coll] = (db.seq[coll] || 0) + 1);
const byId = (coll, id) => db[coll].find((x) => x.id === Number(id));
const must = (coll, id, label) => {
  const row = byId(coll, id);
  if (!row) throw new AppError(`${label} not found`);
  return row;
};
const pad = (n, w = 5) => String(n).padStart(w, '0');
const nowTs = () => Date.now();

function audit(entity, entityId, action, detail, actor) {
  db.audit.unshift({ id: nextId('audit'), entity, entityId, action, detail, actor: actor || 'System', at: nowTs() });
  if (db.audit.length > 3000) db.audit.length = 3000;
}

export const lookups = () => {
  const m = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  return {
    customers: m(db.customers), plans: m(db.plans), products: m(db.products),
    variants: m(db.variants), taxes: m(db.taxes), discounts: m(db.discounts),
  };
};

/* ------------------------------- auth ---------------------------------- */
const publicUser = (u) => u && ({ id: u.id, name: u.name, email: u.email, role: u.role, customerId: u.customerId });

export function login(email, password) {
  const u = db.users.find((x) => x.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!u || u.password !== password) throw new AppError('Incorrect email or password');
  if (!u.active) throw new AppError('This account is disabled');
  return publicUser(u);
}

export function signup({ name, email, password, company, state }) {
  email = String(email || '').trim().toLowerCase();
  const fields = {};
  if (!name?.trim()) fields.name = 'Name is required';
  if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email address';
  else if (db.users.some((u) => u.email === email)) fields.email = 'An account with this email already exists';
  if (!isStrongPassword(password)) fields.password = 'Password does not meet the rules';
  if (Object.keys(fields).length) throw new AppError('Please fix the highlighted fields', fields);
  const customer = {
    id: nextId('customers'), name: company?.trim() || name.trim(), contact: name.trim(), email, phone: '',
    city: '', state: state || COMPANY.state, gstin: '', createdAt: today(),
  };
  db.customers.push(customer);
  const user = { id: nextId('users'), name: name.trim(), email, password, role: 'CUSTOMER', customerId: customer.id, active: true, createdAt: today() };
  db.users.push(user);
  audit('user', user.id, 'Signed up', email, name);
  emit();
  return publicUser(user);
}

/** Returns the reset link (in the real backend it is emailed; here it shows in the dev outbox). */
export function requestPasswordReset(email) {
  const u = db.users.find((x) => x.email === String(email).trim().toLowerCase());
  if (!u) return null; // same response either way — never reveal whether an email exists
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  db.resetTokens.push({ token, userId: u.id, expiresAt: nowTs() + 30 * 60000, used: false });
  emit();
  return `/reset-password/${token}`;
}

export function resetPassword(token, password) {
  const t = db.resetTokens.find((x) => x.token === token);
  if (!t || t.used || t.expiresAt < nowTs()) throw new AppError('This reset link is invalid or has expired');
  if (!isStrongPassword(password)) throw new AppError('Password does not meet the rules', { password: 'Password does not meet the rules' });
  const u = must('users', t.userId, 'User');
  u.password = password;
  t.used = true;
  audit('user', u.id, 'Password reset', u.email, u.name);
  emit();
}

export function addStaff({ name, email, password, role = 'STAFF' }, actor) {
  if (actor?.role !== 'ADMIN') throw new AppError('Only an admin can add staff');
  email = String(email || '').trim().toLowerCase();
  const fields = {};
  if (!name?.trim()) fields.name = 'Name is required';
  if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email address';
  else if (db.users.some((u) => u.email === email)) fields.email = 'An account with this email already exists';
  if (!isStrongPassword(password)) fields.password = 'Password does not meet the rules';
  if (Object.keys(fields).length) throw new AppError('Please fix the highlighted fields', fields);
  const user = { id: nextId('users'), name: name.trim(), email, password, role, customerId: null, active: true, createdAt: today() };
  db.users.push(user);
  audit('user', user.id, 'Staff added', `${name} (${role})`, actor.name);
  emit();
  return publicUser(user);
}

export function toggleUser(id, actor) {
  if (actor?.role !== 'ADMIN') throw new AppError('Only an admin can change users');
  const u = must('users', id, 'User');
  if (u.id === actor.id) throw new AppError('You cannot disable your own account');
  u.active = !u.active;
  emit();
}

/* ------------------------- generic catalog CRUD ------------------------ */
const ADMIN_ONLY = new Set(['products', 'variants', 'plans', 'taxes', 'discounts']);

export function saveRow(coll, data, actor) {
  if (ADMIN_ONLY.has(coll) && actor?.role !== 'ADMIN') throw new AppError('Only an admin can change this');
  if (actor?.role === 'CUSTOMER') throw new AppError('Not allowed');
  if (data.id) {
    const row = must(coll, data.id, 'Record');
    Object.assign(row, data, { id: row.id });
    audit(coll, row.id, 'Updated', row.name || row.number || '', actor?.name);
    emit();
    return row;
  }
  const row = { ...data, id: nextId(coll), createdAt: today() };
  if (coll === 'discounts') row.timesUsed = 0;
  db[coll].push(row);
  audit(coll, row.id, 'Created', row.name || '', actor?.name);
  emit();
  return row;
}

export function setVariants(productId, variants, actor) {
  if (actor?.role !== 'ADMIN') throw new AppError('Only an admin can change products');
  db.variants = db.variants.filter((v) => v.productId !== productId);
  variants.forEach((v) => db.variants.push({ ...v, id: nextId('variants'), productId }));
  emit();
}

/* ---------------------------- subscriptions ---------------------------- */
const TRANSITIONS = {
  send: { from: ['DRAFT'], to: 'QUOTATION', label: 'Quotation sent' },
  confirm: { from: ['QUOTATION'], to: 'CONFIRMED', label: 'Confirmed' },
  activate: { from: ['CONFIRMED'], to: 'ACTIVE', label: 'Activated' },
  pause: { from: ['ACTIVE'], to: 'PAUSED', label: 'Paused' },
  resume: { from: ['PAUSED'], to: 'ACTIVE', label: 'Resumed' },
  close: { from: ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'PAUSED'], to: 'CLOSED', label: 'Closed' },
  renew: { from: ['ACTIVE', 'PAUSED'], to: null, label: 'Renewed' },
};

export const allowedActions = (sub, plan, role) => {
  const out = Object.keys(TRANSITIONS).filter((a) => TRANSITIONS[a].from.includes(sub.state));
  return out.filter((a) => {
    if (a === 'pause' || a === 'resume') return plan?.pausable;
    if (a === 'renew') return plan?.renewable;
    if (role === 'CUSTOMER') return a === 'close' ? plan?.closable && ['ACTIVE', 'PAUSED'].includes(sub.state) : false;
    return true;
  });
};

function validateSub(data) {
  const plan = byId('plans', data.planId);
  const fields = {};
  if (!byId('customers', data.customerId)) fields.customerId = 'Choose a customer';
  if (!plan) fields.planId = 'Choose a plan';
  if (!data.startDate) fields.startDate = 'Start date is required';
  if (data.expiryDate && data.startDate && data.expiryDate <= data.startDate) fields.expiryDate = 'Expiry must be after the start date';
  if (plan) {
    if (Number(data.qty) < plan.minQty) fields.qty = `This plan needs at least ${plan.minQty}`;
    if (plan.startDate && data.startDate < plan.startDate) fields.startDate = `Plan is available from ${plan.startDate}`;
    if (plan.endDate && data.startDate > plan.endDate) fields.startDate = `Plan ended on ${plan.endDate}`;
  }
  (data.lines || []).forEach((l, i) => {
    if (!byId('products', l.productId)) fields[`line${i}`] = 'Choose a product';
    else if (!(Number(l.qty) > 0)) fields[`line${i}`] = 'Quantity must be more than 0';
    else if (!(Number(l.unitPrice) >= 0)) fields[`line${i}`] = 'Price cannot be negative';
  });
  if (Object.keys(fields).length) throw new AppError('Please fix the highlighted fields', fields);
  return plan;
}

export function saveSubscription(data, actor) {
  if (actor?.role === 'CUSTOMER') throw new AppError('Not allowed');
  validateSub(data);
  const lines = (data.lines || []).map((l, i) => ({
    id: i + 1, productId: Number(l.productId), variantId: l.variantId ? Number(l.variantId) : null,
    qty: Number(l.qty), unitPrice: Number(l.unitPrice), taxId: l.taxId ? Number(l.taxId) : null,
  }));
  if (data.id) {
    const sub = must('subscriptions', data.id, 'Subscription');
    if (!['DRAFT', 'QUOTATION'].includes(sub.state)) throw new AppError('Only Draft or Quotation subscriptions can be edited');
    Object.assign(sub, {
      customerId: Number(data.customerId), planId: Number(data.planId), qty: Number(data.qty),
      startDate: data.startDate, expiryDate: data.expiryDate || null, paymentTermsDays: Number(data.paymentTermsDays || 0), lines,
      anchorDay: parseISO(data.startDate).getDate(),
    });
    audit('subscription', sub.id, 'Edited', '', actor?.name);
    emit();
    return sub;
  }
  const id = nextId('subscriptions');
  const sub = {
    id, number: `SUB-${pad(id)}`, customerId: Number(data.customerId), planId: Number(data.planId),
    qty: Number(data.qty), state: 'DRAFT', startDate: data.startDate, expiryDate: data.expiryDate || null,
    nextBillingDate: null, anchorDay: parseISO(data.startDate).getDate(), paymentTermsDays: Number(data.paymentTermsDays || 0),
    validUntil: null, templateId: data.templateId ? Number(data.templateId) : null, pausedOn: null, closedOn: null,
    lines, createdAt: today(),
  };
  db.subscriptions.push(sub);
  audit('subscription', sub.id, 'Created as Draft', sub.number, actor?.name);
  emit();
  return sub;
}

/** Prefills a new subscription from a quotation template. */
export function draftFromTemplate(templateId) {
  const t = must('templates', templateId, 'Template');
  const plan = byId('plans', t.planId);
  const start = today();
  return {
    templateId: t.id, planId: t.planId, qty: Math.max(t.qty || 1, plan?.minQty || 1), startDate: start,
    expiryDate: t.durationMonths ? addMonthsAnchored(start, t.durationMonths, parseISO(start).getDate()) : '',
    paymentTermsDays: t.paymentTermsDays ?? 15, validityDays: t.validityDays,
    lines: t.lines.map((l) => {
      const p = byId('products', l.productId);
      const v = l.variantId ? byId('variants', l.variantId) : null;
      return { productId: l.productId, variantId: l.variantId || '', qty: l.qty, unitPrice: (p?.salesPrice || 0) + (v?.extraPrice || 0), taxId: p?.taxId || '' };
    }),
  };
}

export function transition(subId, action, actor) {
  const sub = must('subscriptions', subId, 'Subscription');
  const plan = byId('plans', sub.planId);
  const role = actor?.role;
  if (role === 'CUSTOMER' && sub.customerId !== actor.customerId) throw new AppError('Subscription not found');
  if (!allowedActions(sub, plan, role).includes(action)) throw new AppError(`Cannot ${action} a ${sub.state.toLowerCase()} subscription`);
  const t = TRANSITIONS[action];
  const d = today();
  let detail = '';
  if (action === 'send') {
    const tpl = sub.templateId ? byId('templates', sub.templateId) : null;
    sub.validUntil = addDays(d, tpl?.validityDays || 15);
    detail = `Valid until ${sub.validUntil}`;
  }
  if (action === 'confirm' && sub.validUntil && sub.validUntil < d) throw new AppError('This quotation has expired. Send a new one.');
  if (action === 'activate') {
    sub.nextBillingDate = sub.startDate; // first period bills on the start date (catch-up if in the past)
    sub.activatedOn = d;
    detail = `Billing from ${sub.nextBillingDate}`;
  }
  if (action === 'pause') { sub.pausedOn = d; }
  if (action === 'resume') {
    const paused = Math.max(0, diffDays(d, sub.pausedOn));
    if (sub.nextBillingDate) sub.nextBillingDate = addDays(sub.nextBillingDate, paused); // paused time is not billed
    if (sub.expiryDate) sub.expiryDate = addDays(sub.expiryDate, paused);
    detail = `Paused ${paused} day(s); next bill ${sub.nextBillingDate}`;
    sub.pausedOn = null;
  }
  if (action === 'close') { sub.closedOn = d; sub.closeReason = role === 'CUSTOMER' ? 'Closed by customer' : 'Closed by staff'; }
  if (action === 'renew') {
    const base = sub.expiryDate && sub.expiryDate > d ? sub.expiryDate : d;
    sub.expiryDate = addMonthsAnchored(base, plan.period === 'YEARLY' ? 12 : plan.period === 'MONTHLY' ? 12 : 3, parseISO(base).getDate());
    detail = `New expiry ${sub.expiryDate}`;
  }
  if (t.to) sub.state = t.to;
  audit('subscription', sub.id, t.label, detail, actor?.name);
  emit();
  return sub;
}

/* ------------------------------- pricing ------------------------------- */
function lineTaxSplit(customer, ratePct, taxable) {
  const tax = Math.round((taxable * ratePct) / 100);
  if (!ratePct) return { tax: 0, cgst: 0, sgst: 0, igst: 0 };
  if (customer?.state === COMPANY.state) {
    const cgst = Math.round(tax / 2);
    return { tax, cgst, sgst: tax - cgst, igst: 0 };
  }
  return { tax, cgst: 0, sgst: 0, igst: tax };
}

function discountAmount(dsc, lines, invoiceDate, totalQty, subtotal) {
  if (!dsc.active) return 0;
  if (dsc.startDate && invoiceDate < dsc.startDate) return 0;
  if (dsc.endDate && invoiceDate > dsc.endDate) return 0;
  if (dsc.usageLimit && dsc.timesUsed >= dsc.usageLimit) return 0;
  let base;
  let qty;
  if (dsc.scope === 'PRODUCT') {
    const eligible = lines.filter((l) => l.productId === dsc.productId);
    base = eligible.reduce((s, l) => s + l.base, 0);
    qty = eligible.reduce((s, l) => s + l.qty, 0);
  } else { base = subtotal; qty = totalQty; }
  if (!base) return 0;
  if (dsc.minAmount && subtotal < dsc.minAmount) return 0;
  if (dsc.minQty && qty < dsc.minQty) return 0;
  const amt = dsc.kind === 'PERCENT' ? Math.round((base * dsc.value) / 100) : dsc.value;
  return Math.min(amt, base); // never negative totals
}

/** Builds invoice lines: plan fee + product lines → best discount → tax. Pure function. */
export function priceSubscription(sub, invoiceDate) {
  const plan = byId('plans', sub.planId);
  const customer = byId('customers', sub.customerId);
  const lines = [];
  const planTax = plan.taxId ? byId('taxes', plan.taxId) : null;
  lines.push({
    kind: 'PLAN', productId: null, description: `${plan.name} plan`, qty: sub.qty, unitPrice: plan.price,
    base: plan.price * sub.qty, taxRate: planTax?.rate || 0, taxName: planTax?.name || 'No tax',
  });
  for (const l of sub.lines) {
    const p = byId('products', l.productId);
    const v = l.variantId ? byId('variants', l.variantId) : null;
    const tx = l.taxId ? byId('taxes', l.taxId) : null;
    lines.push({
      kind: 'PRODUCT', productId: l.productId, description: `${p?.name || 'Product'}${v ? ` (${v.attribute}: ${v.value})` : ''}`,
      qty: l.qty, unitPrice: l.unitPrice, base: l.unitPrice * l.qty, taxRate: tx?.rate || 0, taxName: tx?.name || 'No tax',
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.base, 0);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  // Best single eligible discount (documented stacking rule: one per invoice)
  let best = null;
  let bestAmt = 0;
  for (const d of db.discounts) {
    const a = discountAmount(d, lines, invoiceDate, totalQty, subtotal);
    if (a > bestAmt) { best = d; bestAmt = a; }
  }
  // Spread the discount over eligible lines so tax is computed on the discounted value
  const eligible = best ? lines.filter((l) => best.scope !== 'PRODUCT' || l.productId === best.productId) : [];
  const eligibleBase = eligible.reduce((s, l) => s + l.base, 0);
  let remaining = bestAmt;
  lines.forEach((l) => { l.discount = 0; });
  eligible.forEach((l, i) => {
    const share = i === eligible.length - 1 ? remaining : Math.round((bestAmt * l.base) / eligibleBase);
    l.discount = Math.min(share, l.base);
    remaining -= l.discount;
  });
  lines.forEach((l) => {
    l.taxable = l.base - l.discount;
    Object.assign(l, lineTaxSplit(customer, l.taxRate, l.taxable));
    l.total = l.taxable + l.tax;
  });
  const discountTotal = lines.reduce((s, l) => s + l.discount, 0);
  const taxTotal = lines.reduce((s, l) => s + l.tax, 0);
  return {
    lines, subtotal, discountTotal, taxTotal, total: subtotal - discountTotal + taxTotal,
    discountId: best && bestAmt ? best.id : null, discountName: best && bestAmt ? best.name : null,
  };
}

/** Normalised monthly recurring value of a subscription, before tax. */
export function subMRR(sub) {
  const plan = byId('plans', sub.planId);
  if (!plan) return 0;
  const perPeriod = plan.price * sub.qty + sub.lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  return Math.round(perPeriod * monthlyFactor[plan.period]);
}

/* ---------------------------- billing engine --------------------------- */
/** Last date a subscription may be billed for (expiry or plan end, whichever is first). */
const hardEndOf = (sub) => [sub.expiryDate, byId('plans', sub.planId)?.endDate].filter(Boolean).sort()[0] || null;
/** True when an active subscription has a billing period due on or before `on`. */
export const isDue = (sub, on = today()) => {
  if (sub.state !== 'ACTIVE' || !sub.nextBillingDate || sub.nextBillingDate > on) return false;
  const end = hardEndOf(sub);
  return !end || sub.nextBillingDate <= end;
};
const invoiceKey = (subId, periodStart) => `${subId}|${periodStart}`;

function createInvoice(sub, periodStart, periodEnd, opts = {}) {
  const key = invoiceKey(sub.id, periodStart);
  if (db.invoiceKeys[key]) return null; // UNIQUE(subscription, period) — never bill twice
  const priced = priceSubscription(sub, periodStart);
  const id = nextId('invoices');
  const inv = {
    id, number: null, subscriptionId: sub.id, customerId: sub.customerId, periodStart, periodEnd,
    invoiceDate: periodStart, dueDate: addDays(periodStart, sub.paymentTermsDays || 0), state: 'DRAFT',
    ...priced, amountPaid: 0, sentAt: null, createdAt: opts.at || nowTs(),
  };
  db.invoices.push(inv);
  db.invoiceKeys[key] = id;
  if (inv.discountId) byId('discounts', inv.discountId).timesUsed += 1;
  return inv;
}

/** Bills one subscription up to `upTo` with catch-up. Returns counts. */
function billSubscription(sub, upTo, opts = {}) {
  const plan = byId('plans', sub.planId);
  let created = 0;
  let skipped = 0;
  let guard = 0;
  const hardEnd = [sub.expiryDate, plan.endDate].filter(Boolean).sort()[0] || null;
  while (sub.nextBillingDate && sub.nextBillingDate <= upTo && guard++ < 800) {
    if (hardEnd && sub.nextBillingDate > hardEnd) break;
    const start = sub.nextBillingDate;
    const next = nextPeriodStart(start, plan.period, sub.anchorDay);
    const inv = createInvoice(sub, start, addDays(next, -1), opts);
    if (inv) created += 1; else skipped += 1;
    sub.nextBillingDate = next;
  }
  return { created, skipped };
}

export function runBilling(actor, { upTo } = {}) {
  if (actor?.role === 'CUSTOMER') throw new AppError('Not allowed');
  const t0 = performance.now();
  const runDate = upTo || today();
  let created = 0;
  let skipped = 0;
  let closed = 0;
  let subsBilled = 0;
  for (const sub of db.subscriptions) {
    if (sub.state !== 'ACTIVE') continue;
    const r = billSubscription(sub, runDate);
    created += r.created;
    skipped += r.skipped;
    if (r.created) subsBilled += 1;
    const plan = byId('plans', sub.planId);
    const hardEnd = [sub.expiryDate, plan.endDate].filter(Boolean).sort()[0];
    if (plan.autoClose && hardEnd && hardEnd < runDate) {
      sub.state = 'CLOSED'; sub.closedOn = runDate; sub.closeReason = 'Auto-closed: plan period ended';
      audit('subscription', sub.id, 'Auto-closed', 'Plan period ended', 'Billing run');
      closed += 1;
    }
  }
  const run = {
    id: nextId('billingRuns'), runDate, created, skipped, closed, subsBilled,
    durationMs: Math.round(performance.now() - t0), at: nowTs(), by: actor?.name || 'Scheduler',
  };
  db.billingRuns.unshift(run);
  audit('billing', run.id, 'Billing run', `${created} invoices created, ${skipped} duplicates skipped`, run.by);
  emit();
  return run;
}

/* ------------------------------- invoices ------------------------------ */
export const invoiceBalance = (inv) => inv.total - inv.amountPaid;
export const isOverdue = (inv, on = today()) =>
  ['CONFIRMED', 'PARTIAL'].includes(inv.state) && invoiceBalance(inv) > 0 && inv.dueDate < on;

function assignNumber(inv) {
  const year = inv.invoiceDate.slice(0, 4);
  db.seq[`inv${year}`] = (db.seq[`inv${year}`] || 0) + 1;
  inv.number = `INV/${year}/${pad(db.seq[`inv${year}`])}`;
}

export function confirmInvoices(ids, actor) {
  if (actor?.role === 'CUSTOMER') throw new AppError('Not allowed');
  let n = 0;
  const list = ids.map((id) => byId('invoices', id)).filter((i) => i?.state === 'DRAFT')
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.id - b.id);
  for (const inv of list) { inv.state = 'CONFIRMED'; assignNumber(inv); n += 1; }
  if (n) audit('invoice', 0, 'Invoices confirmed', `${n} invoice(s)`, actor?.name);
  emit();
  return n;
}

export function cancelInvoice(id, actor) {
  if (actor?.role === 'CUSTOMER') throw new AppError('Not allowed');
  const inv = must('invoices', id, 'Invoice');
  if (inv.amountPaid > 0) throw new AppError('An invoice with payments cannot be cancelled');
  if (!['DRAFT', 'CONFIRMED'].includes(inv.state)) throw new AppError('This invoice cannot be cancelled');
  inv.state = 'CANCELLED';
  if (inv.discountId) { const d = byId('discounts', inv.discountId); if (d && d.timesUsed > 0) d.timesUsed -= 1; }
  audit('invoice', inv.id, 'Cancelled', inv.number || `Draft #${inv.id}`, actor?.name);
  emit();
}

export function sendInvoice(id, actor) {
  const inv = must('invoices', id, 'Invoice');
  if (inv.state === 'DRAFT') confirmInvoices([id], actor);
  inv.sentAt = nowTs();
  const c = byId('customers', inv.customerId);
  audit('invoice', inv.id, 'Sent', `Emailed to ${c?.email}`, actor?.name);
  emit();
  return c?.email;
}

/* ------------------------------- payments ------------------------------ */
export function recordPayment({ invoiceId, method, amount, paidOn, note }, actor) {
  if (actor?.role === 'CUSTOMER') throw new AppError('Not allowed');
  const inv = must('invoices', invoiceId, 'Invoice');
  const fields = {};
  if (!['CONFIRMED', 'PARTIAL'].includes(inv.state)) throw new AppError('Payments can only be recorded on confirmed invoices');
  const amt = Number(amount);
  if (!(amt > 0)) fields.amount = 'Amount must be more than 0';
  else if (amt > invoiceBalance(inv)) fields.amount = 'Amount is more than the balance due';
  if (!method) fields.method = 'Choose a payment method';
  if (!paidOn) fields.paidOn = 'Payment date is required';
  else if (paidOn > today()) fields.paidOn = 'Payment date cannot be in the future';
  if (Object.keys(fields).length) throw new AppError('Please fix the highlighted fields', fields);
  const pay = { id: nextId('payments'), invoiceId: inv.id, customerId: inv.customerId, method, amount: amt, paidOn, note: note || '', recordedBy: actor?.name || 'System' };
  db.payments.push(pay);
  inv.amountPaid += amt;
  inv.state = invoiceBalance(inv) === 0 ? 'PAID' : 'PARTIAL';
  audit('invoice', inv.id, 'Payment recorded', `${method} ₹${(amt / 100).toFixed(2)}`, actor?.name);
  emit();
  return pay;
}

/* ------------------------------ reporting ------------------------------ */
export function agingBuckets(on = today()) {
  const b = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
  for (const inv of db.invoices) {
    if (!['CONFIRMED', 'PARTIAL'].includes(inv.state)) continue;
    const bal = invoiceBalance(inv);
    if (bal <= 0) continue;
    const late = diffDays(on, inv.dueDate);
    if (late <= 0) b.current += bal;
    else if (late <= 30) b.d30 += bal;
    else if (late <= 60) b.d60 += bal;
    else if (late <= 90) b.d90 += bal;
    else b.d90p += bal;
  }
  return b;
}

export function summary({ from, to, planId } = {}) {
  const t0 = performance.now();
  const on = today();
  const subs = planId ? db.subscriptions.filter((s) => s.planId === Number(planId)) : db.subscriptions;
  const subIds = planId ? new Set(subs.map((s) => s.id)) : null;
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const active = subs.filter((s) => s.state === 'ACTIVE');
  const mrr = active.reduce((s, x) => s + subMRR(x), 0);
  const customersActive = new Set(active.map((s) => s.customerId)).size;
  let billed = 0; let outstanding = 0; let overdue = 0; let overdueCount = 0; let drafts = 0;
  for (const inv of db.invoices) {
    if (subIds && !subIds.has(inv.subscriptionId)) continue;
    if (inv.state === 'DRAFT') drafts += 1;
    if (['CONFIRMED', 'PARTIAL', 'PAID'].includes(inv.state) && inRange(inv.invoiceDate)) billed += inv.total;
    if (['CONFIRMED', 'PARTIAL'].includes(inv.state)) {
      const bal = invoiceBalance(inv);
      outstanding += bal;
      if (inv.dueDate < on && bal > 0) { overdue += bal; overdueCount += 1; }
    }
  }
  let collected = 0;
  for (const p of db.payments) {
    if (subIds && !subIds.has(byId('invoices', p.invoiceId)?.subscriptionId)) continue;
    if (inRange(p.paidOn)) collected += p.amount;
  }
  return {
    activeSubs: active.length, pausedSubs: subs.filter((s) => s.state === 'PAUSED').length,
    totalSubs: subs.length, mrr, arr: mrr * 12, arpu: customersActive ? Math.round(mrr / customersActive) : 0,
    billed, collected, outstanding, overdue, overdueCount, drafts,
    collectionRate: billed ? (collected / billed) * 100 : 0,
    ms: Math.round(performance.now() - t0),
  };
}

/** Last N months: MRR at month end, billed and collected per month. */
export function trends(months = 12) {
  const on = today();
  const keys = [];
  for (let i = months - 1; i >= 0; i -= 1) keys.push(monthKey(addMonthsAnchored(on.slice(0, 8) + '01', -i, 1)));
  const billed = Object.fromEntries(keys.map((k) => [k, 0]));
  const collected = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const inv of db.invoices) {
    const k = monthKey(inv.invoiceDate);
    if (k in billed && ['CONFIRMED', 'PARTIAL', 'PAID'].includes(inv.state)) billed[k] += inv.total;
  }
  for (const p of db.payments) { const k = monthKey(p.paidOn); if (k in collected) collected[k] += p.amount; }
  return keys.map((k) => {
    const [y, m] = k.split('-').map(Number);
    const end = `${k}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
    let mrr = 0;
    for (const s of db.subscriptions) {
      if (!['ACTIVE', 'PAUSED', 'CLOSED'].includes(s.state) || !s.activatedOn) continue;
      if (s.activatedOn > end) continue;
      if (s.closedOn && s.closedOn <= end) continue;
      if (s.state === 'PAUSED' && s.pausedOn && s.pausedOn <= end) continue;
      mrr += subMRR(s);
    }
    return { key: k, mrr, billed: billed[k], collected: collected[k] };
  });
}

/** Billing Control Centre: the day's action queue. */
export function controlCentre() {
  const on = today();
  const in30 = addDays(on, 30);
  const in7 = addDays(on, 7);
  const L = lookups();
  const renewals = db.subscriptions.filter((s) => ['ACTIVE', 'PAUSED'].includes(s.state) && s.expiryDate && s.expiryDate >= on && s.expiryDate <= in30 && L.plans[s.planId]?.renewable);
  const dueToday = db.subscriptions.filter((s) => isDue(s, on));
  const expiringQuotes = db.subscriptions.filter((s) => s.state === 'QUOTATION' && s.validUntil && s.validUntil <= in7);
  const drafts = db.invoices.filter((i) => i.state === 'DRAFT');
  const overdue = db.invoices.filter((i) => isOverdue(i, on));
  const discounts = db.discounts.filter((d) => d.active && ((d.endDate && d.endDate >= on && d.endDate <= in30) || (d.usageLimit && d.usageLimit - d.timesUsed <= Math.max(5, d.usageLimit * 0.1))));
  return { renewals, dueToday, expiringQuotes, drafts, overdue, discounts };
}

/** Rule-based revenue leakage checks. */
export function leakage() {
  const on = today();
  const missed = db.subscriptions.filter((s) => isDue(s, on) && diffDays(on, s.nextBillingDate) > 0);
  const missedValue = missed.reduce((s, x) => s + subMRR(x), 0);
  const zeroValue = db.subscriptions.filter((s) => s.state === 'ACTIVE' && subMRR(s) === 0);
  const seen = new Map();
  let duplicates = 0;
  for (const inv of db.invoices) {
    if (inv.state === 'CANCELLED') continue;
    const k = invoiceKey(inv.subscriptionId, inv.periodStart);
    if (seen.has(k)) duplicates += 1; else seen.set(k, 1);
  }
  const expiredDiscounts = db.discounts.filter((d) => d.active && d.endDate && d.endDate < on);
  const old = db.invoices.filter((i) => isOverdue(i, on) && diffDays(on, i.dueDate) > 60);
  const oldValue = old.reduce((s, i) => s + invoiceBalance(i), 0);
  const items = [
    { key: 'missed', label: 'Active subscriptions with missed billing', count: missed.length, value: missedValue, fix: 'Run billing', to: '/app/billing' },
    { key: 'dup', label: 'Duplicate invoices for the same period', count: duplicates, value: 0, fix: 'Protected by unique period rule', to: null },
    { key: 'zero', label: 'Active subscriptions billing ₹0', count: zeroValue.length, value: 0, fix: 'Review lines', to: '/app/subscriptions?state=ACTIVE' },
    { key: 'expdisc', label: 'Expired discounts still switched on', count: expiredDiscounts.length, value: 0, fix: 'Turn off', to: '/app/catalog?tab=discounts' },
    { key: 'old', label: 'Invoices overdue for more than 60 days', count: old.length, value: oldValue, fix: 'Chase payment', to: '/app/invoices?filter=overdue' },
  ];
  return { items, atRisk: missedValue + oldValue };
}

/* ------------------------------ bulk demo ------------------------------ */
export function generateBulk(count, actor) {
  if (actor?.role !== 'ADMIN') throw new AppError('Only an admin can generate demo data');
  const t0 = performance.now();
  const rnd = rng(count + db.subscriptions.length);
  const on = today();
  const firstNew = db.invoices.length;
  for (let i = 0; i < count; i += 1) {
    const sub = makeSeedSub(rnd, on, true);
    billSubscription(sub, addDays(on, -1), { at: nowTs() });
  }
  db.invoices.slice(firstNew).forEach((inv) => {
    inv.state = 'CONFIRMED'; assignNumber(inv);
    if (inv.dueDate < addDays(on, -15) && rnd() < 0.9) { inv.amountPaid = inv.total; inv.state = 'PAID';
      db.payments.push({ id: nextId('payments'), invoiceId: inv.id, customerId: inv.customerId, method: 'UPI', amount: inv.total, paidOn: inv.dueDate, note: '', recordedBy: 'System' }); }
  });
  persistOff = true; // too large for localStorage; keeps working in memory
  audit('system', 0, 'Bulk demo data', `${count} subscriptions generated`, actor.name);
  emit();
  return Math.round(performance.now() - t0);
}

/* -------------------------------- seed --------------------------------- */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

function makeSeedSub(rnd, on, forceActive = false) {
  const plan = pick(rnd, db.plans.filter((p) => p.active !== false && p.period !== 'DAILY'));
  const customer = pick(rnd, db.customers);
  const ageDays = Math.floor(rnd() * 420) + 5;
  const start = addDays(on, -ageDays);
  const qty = Math.max(plan.minQty, Math.floor(rnd() * 12) + 1);
  const lines = [];
  const nLines = Math.floor(rnd() * 3);
  for (let j = 0; j < nLines; j += 1) {
    const p = pick(rnd, db.products);
    if (lines.some((l) => l.productId === p.id)) continue;
    const vs = db.variants.filter((v) => v.productId === p.id);
    const v = vs.length && rnd() < 0.6 ? pick(rnd, vs) : null;
    lines.push({ id: j + 1, productId: p.id, variantId: v?.id || null, qty: Math.floor(rnd() * 3) + 1, unitPrice: p.salesPrice + (v?.extraPrice || 0), taxId: p.taxId });
  }
  const expiry = plan.period === 'YEARLY' ? addMonthsAnchored(start, 24, parseISO(start).getDate())
    : plan.period === 'WEEKLY' ? addDays(start, 26 * 7) : addMonthsAnchored(start, 12 + Math.floor(rnd() * 12), parseISO(start).getDate());
  const id = nextId('subscriptions');
  const sub = {
    id, number: `SUB-${pad(id)}`, customerId: customer.id, planId: plan.id, qty, state: 'ACTIVE',
    startDate: start, expiryDate: expiry, nextBillingDate: start, anchorDay: parseISO(start).getDate(),
    paymentTermsDays: pick(rnd, [0, 7, 15, 15, 30]), validUntil: null, templateId: null, pausedOn: null, closedOn: null,
    activatedOn: start, lines, createdAt: start,
  };
  if (!forceActive) {
    const r = rnd();
    if (r < 0.07) { sub.state = 'PAUSED'; }
    else if (r < 0.15) { sub.state = 'CLOSED'; }
  }
  db.subscriptions.push(sub);
  return sub;
}

function seed() {
  db = {
    seq: {}, users: [], customers: [], products: [], variants: [], plans: [], taxes: [], discounts: [], templates: [],
    subscriptions: [], invoices: [], invoiceKeys: {}, payments: [], audit: [], billingRuns: [], resetTokens: [],
  };
  const on = todayIST();
  const rnd = rng(20261031);
  const P = (rupees) => Math.round(rupees * 100);

  // Taxes
  [['GST 18%', 18, 'GST'], ['GST 12%', 12, 'GST'], ['GST 5%', 5, 'GST'], ['Exempt', 0, 'Exempt']]
    .forEach(([name, rate, type]) => db.taxes.push({ id: nextId('taxes'), name, rate, type, active: true }));

  // Products & variants
  const prods = [
    ['Analytics Pro', 'Software', 799, 210, 'Advanced dashboards and exports'],
    ['Cloud Storage', 'Service', 299, 90, 'Secure file storage'],
    ['Priority Support', 'Service', 999, 400, '4-hour response SLA'],
    ['ERP Connector', 'Add-on', 1200, 350, 'Sync invoices with your ERP'],
    ['Extra Workspace', 'Add-on', 450, 60, 'Additional team workspace'],
    ['Onboarding & Training', 'Service', 2500, 1100, 'Live training sessions'],
  ];
  prods.forEach(([name, type, price, cost, notes]) => db.products.push({ id: nextId('products'), name, type, salesPrice: P(price), costPrice: P(cost), notes, taxId: 1, active: true }));
  [[2, 'Size', '100 GB', 0], [2, 'Size', '500 GB', 400], [2, 'Size', '1 TB', 900],
    [4, 'Brand', 'Odoo', 560], [4, 'Brand', 'Zoho', 300], [4, 'Brand', 'Tally', 250]]
    .forEach(([productId, attribute, value, extra]) => db.variants.push({ id: nextId('variants'), productId, attribute, value, extraPrice: P(extra) }));

  // Recurring plans
  const yr = on.slice(0, 4);
  [
    ['Starter', 'MONTHLY', 499, 1, true, true, true, true],
    ['Business', 'MONTHLY', 1299, 5, true, true, true, false],
    ['Enterprise', 'YEARLY', 12999, 10, false, false, true, false],
    ['Flex Weekly', 'WEEKLY', 199, 1, true, true, false, true],
    ['Event Day Pass', 'DAILY', 49, 1, true, false, false, true],
  ].forEach(([name, period, price, minQty, closable, pausable, renewable, autoClose]) => db.plans.push({
    id: nextId('plans'), name, period, price: P(price), minQty, closable, pausable, renewable, autoClose,
    startDate: `${Number(yr) - 2}-01-01`, endDate: name === 'Event Day Pass' ? `${yr}-12-31` : null, taxId: 1, active: true,
  }));

  // Discounts (admin rules)
  db.discounts.push(
    { id: nextId('discounts'), name: 'Volume 10+ seats', kind: 'PERCENT', value: 10, minAmount: 0, minQty: 10, startDate: `${Number(yr) - 1}-01-01`, endDate: `${Number(yr) + 1}-12-31`, usageLimit: 0, timesUsed: 0, scope: 'SUBSCRIPTION', productId: null, active: true },
    { id: nextId('discounts'), name: 'Diwali Offer', kind: 'FIXED', value: P(500), minAmount: P(3000), minQty: 0, startDate: addDays(on, -20), endDate: addDays(on, 12), usageLimit: 150, timesUsed: 0, scope: 'SUBSCRIPTION', productId: null, active: true },
    { id: nextId('discounts'), name: 'Connector Launch 15%', kind: 'PERCENT', value: 15, minAmount: 0, minQty: 0, startDate: addDays(on, -90), endDate: addDays(on, 60), usageLimit: 120, timesUsed: 0, scope: 'PRODUCT', productId: 4, active: true },
    { id: nextId('discounts'), name: 'Monsoon Sale', kind: 'PERCENT', value: 8, minAmount: P(1000), minQty: 0, startDate: addDays(on, -150), endDate: addDays(on, -60), usageLimit: 0, timesUsed: 0, scope: 'SUBSCRIPTION', productId: null, active: true },
  );

  // Quotation templates
  db.templates.push(
    { id: nextId('templates'), name: 'Business Standard', planId: 2, qty: 5, validityDays: 15, paymentTermsDays: 15, durationMonths: 12, lines: [{ productId: 1, variantId: null, qty: 1 }, { productId: 3, variantId: null, qty: 1 }], notes: 'Most popular for growing teams' },
    { id: nextId('templates'), name: 'Enterprise Annual', planId: 3, qty: 25, validityDays: 30, paymentTermsDays: 30, durationMonths: 24, lines: [{ productId: 4, variantId: 4, qty: 1 }, { productId: 2, variantId: 2, qty: 2 }], notes: 'Includes ERP connector (Odoo brand)' },
    { id: nextId('templates'), name: 'Starter Self-Serve', planId: 1, qty: 1, validityDays: 7, paymentTermsDays: 0, durationMonths: 12, lines: [], notes: 'For small shops' },
  );

  // Customers
  const names = ['Kochi Digital Studio', 'Malabar Spice Traders', 'Thrissur Textiles', 'Periyar Health Clinic', 'Lotus Learning Hub', 'Coastline Logistics', 'Greenleaf Organics', 'Bharat Auto Parts', 'Sahyadri Software', 'Nila Interiors', 'Ganga Retail Mart', 'Deccan Fintech', 'Pink City Crafts', 'Konark Travels', 'Brahmaputra Tea Co', 'Marina Bay Foods', 'Silicon Plateau Labs', 'Narmada Builders', 'Himalaya Wellness', 'Vindhya Media', 'Cauvery Dairy', 'Aravalli Steel', 'Godavari Pharma', 'Western Ghats Resorts', 'Saffron Events', 'Indigo Print House', 'Monsoon Cafe Chain', 'Tusker Security', 'Banyan Legal', 'Peacock Fashion'];
  const places = [['Kochi', 'Kerala'], ['Thrissur', 'Kerala'], ['Kozhikode', 'Kerala'], ['Bengaluru', 'Karnataka'], ['Chennai', 'Tamil Nadu'], ['Mumbai', 'Maharashtra'], ['Pune', 'Maharashtra'], ['Hyderabad', 'Telangana'], ['Jaipur', 'Rajasthan'], ['Delhi', 'Delhi'], ['Kolkata', 'West Bengal'], ['Ahmedabad', 'Gujarat']];
  names.forEach((name, i) => {
    const [city, state] = i === 0 ? ['Kochi', 'Kerala'] : pick(rnd, places);
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '');
    db.customers.push({ id: nextId('customers'), name, contact: '', email: i === 0 ? 'customer@subsync.in' : `accounts@${slug}.in`, phone: `+91 9${String(Math.floor(rnd() * 1e9)).padStart(9, '0')}`, city, state, gstin: '', createdAt: addDays(on, -430) });
  });

  // Users (demo logins). The Django backend stores hashed passwords; this mock compares plain text.
  db.users.push(
    { id: nextId('users'), name: 'Ann Rose', email: 'admin@subsync.in', password: 'Admin@12345', role: 'ADMIN', customerId: null, active: true },
    { id: nextId('users'), name: 'Rahul Menon', email: 'staff@subsync.in', password: 'Staff@12345', role: 'STAFF', customerId: null, active: true },
    { id: nextId('users'), name: 'Meera Nair', email: 'customer@subsync.in', password: 'Customer@123', role: 'CUSTOMER', customerId: 1, active: true },
  );

  // Subscriptions with history
  const yesterday = addDays(on, -1);
  for (let i = 0; i < 260; i += 1) {
    const sub = makeSeedSub(rnd, on);
    if (i < 3) { sub.customerId = 1; sub.state = 'ACTIVE'; }
    const finalState = sub.state;
    let stop = yesterday;
    if (finalState === 'PAUSED') { sub.pausedOn = addDays(on, -Math.floor(rnd() * 40) - 3); stop = addDays(sub.pausedOn, -1); }
    if (finalState === 'CLOSED') { sub.closedOn = addDays(on, -Math.floor(rnd() * 120) - 5); stop = addDays(sub.closedOn, -1); sub.closeReason = 'Closed by customer'; }
    if (sub.expiryDate < stop) stop = sub.expiryDate;
    // Leave a few with a missed billing period (shows up as leakage, fixed by Run Billing)
    if (finalState === 'ACTIVE' && i % 37 === 5) stop = addDays(on, -40);
    sub.state = 'ACTIVE';
    billSubscription(sub, stop, { at: 1 });
    sub.state = finalState;
    if (finalState === 'ACTIVE' && sub.expiryDate < on) {
      sub.expiryDate = addMonthsAnchored(sub.expiryDate, 12, sub.anchorDay); // renewed
      billSubscription(sub, i % 37 === 5 ? addDays(on, -40) : yesterday, { at: 1 });
    }
  }
  // A few renewals due soon
  db.subscriptions.filter((s) => s.state === 'ACTIVE').slice(5, 14).forEach((s, i) => { s.expiryDate = addDays(on, 4 + i * 3); });

  // Pipeline: drafts and quotations
  [[2, 'DRAFT', 1], [5, 'QUOTATION', 0], [8, 'QUOTATION', 1], [11, 'CONFIRMED', 1], [14, 'DRAFT', 2], [17, 'QUOTATION', 2]].forEach(([cust, state, tpl]) => {
    const d = draftFromTemplate(tpl + 1);
    const id = nextId('subscriptions');
    db.subscriptions.push({
      id, number: `SUB-${pad(id)}`, customerId: cust, planId: d.planId, qty: d.qty, state, startDate: addDays(on, 3),
      expiryDate: d.expiryDate ? addDays(d.expiryDate, 3) : null, nextBillingDate: null, anchorDay: parseISO(addDays(on, 3)).getDate(),
      paymentTermsDays: d.paymentTermsDays, validUntil: state === 'QUOTATION' ? addDays(on, cust === 5 ? 2 : 10) : null,
      templateId: tpl + 1, pausedOn: null, closedOn: null, activatedOn: null,
      lines: d.lines.map((l, j) => ({ id: j + 1, productId: l.productId, variantId: l.variantId || null, qty: l.qty, unitPrice: l.unitPrice, taxId: l.taxId || null })),
      createdAt: addDays(on, -2),
    });
  });

  // Confirm history in date order (gap-free numbers), keep the latest few as drafts
  const sorted = [...db.invoices].sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || a.id - b.id);
  const draftCut = addDays(on, -3);
  sorted.forEach((inv) => { if (inv.invoiceDate < draftCut || rnd() < 0.5) { inv.state = 'CONFIRMED'; assignNumber(inv); } });

  // Payments
  const methods = ['UPI', 'UPI', 'UPI', 'BANK', 'BANK', 'CARD', 'CASH'];
  for (const inv of db.invoices) {
    if (inv.state !== 'CONFIRMED') continue;
    const late = diffDays(on, inv.dueDate);
    const r = rnd();
    let share = 0;
    if (late > 120) share = 1;
    else if (late > 30) share = r < 0.94 ? 1 : r < 0.97 ? 0.5 : 0;
    else if (late > 0) share = r < 0.72 ? 1 : r < 0.82 ? 0.4 : 0;
    else share = r < 0.45 ? 1 : 0;
    if (!share) continue;
    const amount = share === 1 ? inv.total : Math.round(inv.total * share);
    let paidOn = addDays(inv.invoiceDate, Math.floor(rnd() * (inv.dueDate === inv.invoiceDate ? 5 : diffDays(inv.dueDate, inv.invoiceDate) + 6)));
    if (paidOn > on) paidOn = on;
    db.payments.push({ id: nextId('payments'), invoiceId: inv.id, customerId: inv.customerId, method: pick(rnd, methods), amount, paidOn, note: share === 1 ? '' : 'Part payment', recordedBy: 'Rahul Menon' });
    inv.amountPaid = amount;
    inv.state = amount === inv.total ? 'PAID' : 'PARTIAL';
  }
  db.payments.sort((a, b) => a.paidOn.localeCompare(b.paidOn));
  db.payments.forEach((p, i) => { p.id = i + 1; });
  db.seq.payments = db.payments.length;

  // Lifecycle history so timelines and recent activity are not empty
  const ts = (iso, h = 10) => parseISO(iso).getTime() + h * 3600000;
  db.subscriptions.forEach((s) => {
    db.audit.push({ id: nextId('audit'), entity: 'subscription', entityId: s.id, action: 'Created as Draft', detail: s.number, actor: 'Rahul Menon', at: ts(addDays(s.startDate, -3), 11) });
    if (s.activatedOn) {
      db.audit.push({ id: nextId('audit'), entity: 'subscription', entityId: s.id, action: 'Quotation sent', detail: '', actor: 'Rahul Menon', at: ts(addDays(s.startDate, -2), 12) });
      db.audit.push({ id: nextId('audit'), entity: 'subscription', entityId: s.id, action: 'Activated', detail: `Billing from ${s.startDate}`, actor: 'Rahul Menon', at: ts(s.startDate, 9) });
    }
    if (s.pausedOn) db.audit.push({ id: nextId('audit'), entity: 'subscription', entityId: s.id, action: 'Paused', detail: '', actor: 'Ann Rose', at: ts(s.pausedOn, 15) });
    if (s.closedOn) db.audit.push({ id: nextId('audit'), entity: 'subscription', entityId: s.id, action: 'Closed', detail: s.closeReason, actor: 'Ann Rose', at: ts(s.closedOn, 16) });
  });
  db.payments.slice(-6).forEach((p) => db.audit.push({ id: nextId('audit'), entity: 'invoice', entityId: p.invoiceId, action: 'Payment recorded', detail: `${p.method} ₹${(p.amount / 100).toLocaleString('en-IN')}`, actor: 'Rahul Menon', at: ts(p.paidOn, 14) }));
  db.audit.sort((a, b) => b.at - a.at);
  audit('system', 0, 'Demo data loaded', `${db.subscriptions.length} subscriptions, ${db.invoices.length} invoices`, 'System');
  return db;
}
