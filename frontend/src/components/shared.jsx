import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Status, Modal, Field, Empty } from './ui';
import { inr, fmtDate } from '../lib/format';
import { periodLabel, todayIST } from '../lib/dates';
import { api } from '../data/api';
import { useAction } from '../lib/hooks';
import { Receipt, Repeat } from 'lucide-react';

/** Keeps list filters in the URL so links like ?filter=overdue work and back/forward behave. */
export function useUrlState(defaults) {
  const [sp, setSp] = useSearchParams();
  const state = { ...defaults };
  Object.keys(defaults).forEach((k) => { if (sp.get(k) !== null) state[k] = sp.get(k); });
  state.page = Number(sp.get('page') || 1);
  const set = (patch) => {
    const next = { ...state, ...patch };
    if (!('page' in patch)) next.page = 1;
    const out = {};
    Object.entries(next).forEach(([k, v]) => { if (v !== '' && v != null && !(k === 'page' && v === 1)) out[k] = v; });
    setSp(out, { replace: true });
  };
  return [state, set];
}

export function SubscriptionTable({ rows, base = '/app/subscriptions', showCustomer = true }) {
  const nav = useNavigate();
  if (!rows.length) return <Empty icon={Repeat} title="No subscriptions found" text="Try a different filter or create a new subscription." />;
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr>
          <th>Number</th>{showCustomer && <th>Customer</th>}<th>Plan</th><th className="r">Qty</th><th>Start</th><th>Next bill</th><th>Expiry</th><th className="r">MRR</th><th>Status</th>
        </tr></thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="cursor-pointer" onClick={() => nav(`${base}/${s.id}`)}>
              <td className="font-medium text-plum">{s.number}</td>
              {showCustomer && <td>{s.customer}</td>}
              <td>{s.plan}<span className="text-muted text-[12px]"> · {periodLabel[s.period]}</span></td>
              <td className="r num">{s.qty}</td>
              <td className="num">{fmtDate(s.startDate)}</td>
              <td className="num">{s.state === 'ACTIVE' ? fmtDate(s.nextBillingDate) : '—'}</td>
              <td className="num">{fmtDate(s.expiryDate)}</td>
              <td className="r num">{inr(s.mrr)}</td>
              <td><Status value={s.state} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function InvoiceTable({ rows, base = '/app/invoices', showCustomer = true, selectable, selected, onSelect, onPay, payLabel = 'Record payment', payTone }) {
  const nav = useNavigate();
  if (!rows.length) return <Empty icon={Receipt} title="No invoices found" text="Invoices appear here after a billing run." />;
  const drafts = rows.filter((r) => r.state === 'DRAFT');
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr>
          {selectable && <th className="w-8"><input type="checkbox" aria-label="Select all drafts" checked={drafts.length > 0 && drafts.every((r) => selected.has(r.id))} onChange={(e) => onSelect(e.target.checked ? drafts.map((r) => r.id) : [])} /></th>}
          <th>Number</th>{showCustomer && <th>Customer</th>}<th>Period</th><th>Due</th><th className="r">Total</th><th className="r">Balance</th><th>Status</th>{onPay && <th />}
        </tr></thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} className={`cursor-pointer ${selected?.has(i.id) ? 'bg-plum-subtle' : ''}`} onClick={() => nav(`${base}/${i.id}`)}>
              {selectable && <td onClick={(e) => e.stopPropagation()}>{i.state === 'DRAFT' && <input type="checkbox" aria-label={`Select draft ${i.id}`} checked={selected.has(i.id)} onChange={(e) => onSelect(e.target.checked ? [...selected, i.id] : [...selected].filter((x) => x !== i.id))} />}</td>}
              <td className="font-medium text-plum">{i.number || <span className="text-muted">Draft #{i.id}</span>}</td>
              {showCustomer && <td>{i.customer}</td>}
              <td className="num text-[12px]">{fmtDate(i.periodStart)} – {fmtDate(i.periodEnd)}</td>
              <td className={`num ${i.overdue ? 'text-bad font-medium' : ''}`}>{fmtDate(i.dueDate)}{i.overdue && <div className="text-[11px]">{i.daysOverdue} days late</div>}</td>
              <td className="r num">{inr(i.total)}</td>
              <td className="r num font-medium">{['CONFIRMED', 'PARTIAL'].includes(i.state) ? inr(i.balance) : '—'}</td>
              <td><Status value={i.state} overdue={i.overdue} /></td>
              {onPay && <td onClick={(e) => e.stopPropagation()}>{['CONFIRMED', 'PARTIAL'].includes(i.state) && <button className={payTone === 'teal' ? "btn-teal btn-sm" : "btn-secondary btn-sm"} onClick={() => onPay(i)}>{payLabel}</button>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RecordPaymentModal({ invoice, onClose }) {
  const { exec, busy, fieldErrors } = useAction();
  const [f, setF] = useState(() => ({ method: 'UPI', amount: invoice ? (invoice.balance / 100).toFixed(2) : '', paidOn: todayIST(), note: '' }));
  if (!invoice) return null;
  const submit = async (e) => {
    e.preventDefault();
    const r = await exec(() => api.recordPayment({ invoiceId: invoice.id, method: f.method, amount: Math.round(Number(f.amount) * 100), paidOn: f.paidOn, note: f.note }),
      (p) => `Payment of ${inr(p.amount)} recorded on ${invoice.number}`);
    if (r.ok) onClose();
  };
  return (
    <Modal open onClose={onClose} title={`Record payment · ${invoice.number}`}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" form="payform" disabled={busy}>Save payment</button></>}>
      <form id="payform" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3 bg-canvas rounded p-3 text-[13px]">
          <div><div className="text-muted">Total</div><div className="font-medium num">{inr(invoice.total)}</div></div>
          <div><div className="text-muted">Balance due</div><div className="font-semibold text-warn num">{inr(invoice.balance)}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment method">
            <select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>
              {['UPI', 'Bank transfer', 'Credit card', 'Debit card', 'Cheque', 'Cash'].map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Amount (₹)" error={fieldErrors?.amount}>
            <input type="number" step="0.01" className="input num" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required />
          </Field>
          <Field label="Payment date">
            <input type="date" className="input" value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} />
          </Field>
          <Field label="Reference / note">
            <input className="input" placeholder="e.g. UPI ref or bank UTR" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
