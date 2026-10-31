import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X, CircleAlert } from 'lucide-react';

export function Logo({ size = 'md', to = '/', compact = false }) {
  const box = size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-xl';
  const text = size === 'sm' ? 'text-xl' : 'text-2xl';
  return (
    <Link to={to} className="flex items-center gap-2.5 group" aria-label="SubSync home">
      <div className={`${box} bg-plum flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
        </svg>
      </div>
      <span className={`${text} font-bold tracking-tight text-charcoal ${compact ? 'hidden sm:inline' : ''}`}>sub<span className="text-plum">sync</span></span>
    </Link>
  );
}

/* Status badges — colours from DESIGN.md */
const TONES = {
  gray: 'bg-line text-muted',
  green: 'bg-ok-bg text-ok',
  amber: 'bg-warn-bg text-warn',
  red: 'bg-bad-bg text-bad',
  plum: 'bg-plum-subtle text-plum',
  teal: 'bg-teal-soft text-teal',
};
const STATUS = {
  DRAFT: ['Draft', 'gray'], QUOTATION: ['Quotation', 'plum'], CONFIRMED: ['Confirmed', 'teal'], ACTIVE: ['Active', 'green'],
  PAUSED: ['Paused', 'amber'], CLOSED: ['Closed', 'gray'], PARTIAL: ['Partially paid', 'amber'], PAID: ['Paid', 'green'],
  CANCELLED: ['Cancelled', 'red'], OVERDUE: ['Overdue', 'red'], ADMIN: ['Admin', 'plum'], STAFF: ['Staff', 'teal'], CUSTOMER: ['Customer', 'gray'],
};
export function Badge({ tone = 'gray', children }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-label uppercase ${TONES[tone]}`}>{children}</span>;
}
export function Status({ value, overdue }) {
  if (overdue) return <Badge tone="red">Overdue</Badge>;
  const [label, tone] = STATUS[value] || [value, 'gray'];
  return <Badge tone={tone}>{label}</Badge>;
}

export function PageHeader({ title, subtitle, crumbs, actions, children }) {
  return (
    <div className="mb-5">
      {crumbs && (
        <nav className="text-[12px] text-muted mb-1.5 flex items-center gap-1" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} />}
              {c.to ? <Link to={c.to} className="hover:text-plum">{c.label}</Link> : <span>{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-7 font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-muted text-[13px] mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, action, children, className = '', pad = true }) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint, tone = 'plum', icon: Icon, to }) {
  const ring = { plum: 'bg-plum-subtle text-plum', teal: 'bg-teal-soft text-teal', green: 'bg-ok-bg text-ok', amber: 'bg-warn-bg text-warn', red: 'bg-bad-bg text-bad' }[tone];
  const body = (
    <div className="card p-4 h-full hover:shadow-l1 transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <span className="micro">{label}</span>
        {Icon && <span className={`w-8 h-8 rounded-md flex items-center justify-center ${ring}`}><Icon size={16} /></span>}
      </div>
      <div className="text-[24px] font-semibold tracking-tight mt-1 num">{value}</div>
      {hint && <div className="text-[12px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

export function Field({ label, error, hint, children, required, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="label">{label}{required && <span className="text-bad"> *</span>}</span>}
      {children}
      {error ? <span className="flex items-center gap-1 text-[12px] text-bad mt-1"><CircleAlert size={12} />{error}</span>
        : hint ? <span className="block text-[12px] text-muted mt-1">{hint}</span> : null}
    </label>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-charcoal/40" onClick={onClose} />
      <div className={`relative bg-white rounded-lg shadow-l2 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} my-8`}>
        <header className="flex items-center justify-between px-5 py-3.5 border-b border-line">
          <h2 className="text-[16px] font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted hover:text-charcoal" aria-label="Close"><X size={18} /></button>
        </header>
        <div className="p-5">{children}</div>
        {footer && <footer className="px-5 py-3.5 border-t border-line bg-canvas rounded-b-lg flex justify-end gap-2">{footer}</footer>}
      </div>
    </div>
  );
}

export function Pagination({ page, size, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return <div className="text-[12px] text-muted px-1 py-3">{total} record{total === 1 ? '' : 's'}</div>;
  return (
    <div className="flex items-center justify-between px-1 py-3 text-[12px] text-muted">
      <span className="num">{(page - 1) * size + 1}–{Math.min(page * size, total)} of {total.toLocaleString('en-IN')}</span>
      <div className="flex items-center gap-1">
        <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={14} /></button>
        <span className="px-2 num">Page {page} / {pages}</span>
        <button className="btn-secondary btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={14} /></button>
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 border-b border-line mb-4 overflow-x-auto" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={`px-3.5 py-2.5 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${value === t.value ? 'border-plum text-plum' : 'border-transparent text-muted hover:text-charcoal'}`}>
          {t.label}{t.count != null && <span className="ml-1.5 text-[11px] bg-canvas border border-line rounded px-1.5 num">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && <div className="w-12 h-12 mx-auto rounded-xl bg-plum-subtle text-plum flex items-center justify-center mb-3"><Icon size={22} /></div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="text-muted text-[13px] mt-1 max-w-sm mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Loading({ rows = 5 }) {
  return (
    <div className="space-y-2 animate-pulse" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-9 bg-line/60 rounded" />)}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[13px]">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full p-0.5 transition-colors ${checked ? 'bg-plum' : 'bg-line'}`}>
        <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      {label}
    </label>
  );
}

export function KeyValue({ items }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="micro">{k}</dt>
          <dd className="mt-0.5 text-[14px]">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
