// All billing dates are plain YYYY-MM-DD strings in IST (Asia/Kolkata).

const pad = (n) => String(n).padStart(2, '0');

export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Today in IST, as YYYY-MM-DD. */
export const todayIST = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + (now.getTimezoneOffset() + 330) * 60000);
  return toISO(ist);
};

export const addDays = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const diffDays = (a, b) => Math.round((parseISO(a) - parseISO(b)) / 86400000);

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

/**
 * Month-end safe month addition, always computed from the anchor day so the
 * 31st never drifts: anchor 31 → Jan 31, Feb 28/29, Mar 31, Apr 30 …
 */
export const addMonthsAnchored = (iso, months, anchorDay) => {
  const d = parseISO(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + months;
  const ty = y + Math.floor(m / 12);
  const tm = ((m % 12) + 12) % 12;
  const day = Math.min(anchorDay || d.getDate(), daysInMonth(ty, tm));
  return toISO(new Date(ty, tm, day));
};

/** Start of the next billing period for a plan period. */
export const nextPeriodStart = (iso, period, anchorDay) => {
  switch (period) {
    case 'DAILY': return addDays(iso, 1);
    case 'WEEKLY': return addDays(iso, 7);
    case 'MONTHLY': return addMonthsAnchored(iso, 1, anchorDay);
    case 'YEARLY': return addMonthsAnchored(iso, 12, anchorDay);
    default: throw new Error(`Unknown period ${period}`);
  }
};

/** Multiplier that converts one period's charge into a monthly figure (for MRR). */
export const monthlyFactor = { DAILY: 365 / 12, WEEKLY: 52 / 12, MONTHLY: 1, YEARLY: 1 / 12 };

export const periodLabel = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' };

export const monthKey = (iso) => iso.slice(0, 7);
export const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};
