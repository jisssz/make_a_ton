// Money is kept as integer paise inside the app to avoid floating-point errors.
export const toPaise = (rupees) => Math.round(Number(rupees || 0) * 100);
export const toRupees = (paise) => (paise || 0) / 100;

const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
const inrShort = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

/** ₹1,25,000.00 (Indian numbering) */
export const inr = (paise) => inrFmt.format(toRupees(paise));
/** ₹1,25,000 */
export const inr0 = (paise) => inrShort.format(toRupees(paise));
/** ₹1.2L / ₹3.4Cr for KPI cards */
export const inrCompact = (paise) => {
  const r = toRupees(paise);
  if (Math.abs(r) >= 1e7) return `₹${(r / 1e7).toFixed(2)}Cr`;
  if (Math.abs(r) >= 1e5) return `₹${(r / 1e5).toFixed(2)}L`;
  return inrShort.format(r);
};

export const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const fmtDateTime = (ts) =>
  ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export const pct = (n) => `${(n || 0).toFixed(1)}%`;

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
