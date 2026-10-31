import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Send, Check, Play, Pause, XCircle, RotateCcw, Pencil, Clock } from 'lucide-react';
import { PageHeader, Card, Loading, Status, Empty, KeyValue, Modal } from '../../components/ui';
import { InvoiceTable } from '../../components/shared';
import { api } from '../../data/api';
import { useQuery, useAction } from '../../lib/hooks';
import { inr, fmtDate, fmtDateTime } from '../../lib/format';
import { periodLabel } from '../../lib/dates';

const STEPS = ['DRAFT', 'QUOTATION', 'CONFIRMED', 'ACTIVE', 'CLOSED'];
const STEP_LABEL = { DRAFT: 'Draft', QUOTATION: 'Quotation', CONFIRMED: 'Confirmed', ACTIVE: 'Active', CLOSED: 'Closed' };
const ACTIONS = {
  send: { label: 'Send quotation', icon: Send, cls: 'btn-primary', ok: 'Quotation sent to the customer' },
  confirm: { label: 'Confirm', icon: Check, cls: 'btn-primary', ok: 'Quotation confirmed' },
  activate: { label: 'Activate', icon: Play, cls: 'btn-teal', ok: 'Subscription is active — it will be billed from its start date' },
  pause: { label: 'Pause', icon: Pause, cls: 'btn-secondary', ok: 'Subscription paused — no invoices while paused' },
  resume: { label: 'Resume', icon: Play, cls: 'btn-teal', ok: 'Subscription resumed' },
  renew: { label: 'Renew', icon: RotateCcw, cls: 'btn-secondary', ok: 'Subscription renewed' },
  close: { label: 'Close', icon: XCircle, cls: 'btn-danger', ok: 'Subscription closed', confirm: true },
};

/** Odoo-style status bar */
function StatusBar({ state }) {
  const idx = state === 'PAUSED' ? 3 : STEPS.indexOf(state);
  return (
    <div className="flex items-stretch border border-line rounded overflow-hidden text-[12px] font-medium bg-white" aria-label="Lifecycle">
      {STEPS.map((s, i) => (
        <div key={s} className={`px-3 py-1.5 border-r border-line last:border-r-0 ${i === idx ? 'bg-plum text-white' : i < idx ? 'text-plum bg-plum-subtle' : 'text-muted'}`}>
          {s === 'ACTIVE' && state === 'PAUSED' ? 'Paused' : STEP_LABEL[s]}
        </div>
      ))}
    </div>
  );
}

export function TaxBox({ preview, customer, company }) {
  const intra = customer?.state === company?.state;
  const cgst = preview.lines.reduce((a, l) => a + (l.cgst || 0), 0);
  const sgst = preview.lines.reduce((a, l) => a + (l.sgst || 0), 0);
  const igst = preview.lines.reduce((a, l) => a + (l.igst || 0), 0);
  return (
    <dl className="text-[13px] space-y-1.5 min-w-[260px]">
      <div className="flex justify-between"><dt>Subtotal</dt><dd className="num">{inr(preview.subtotal)}</dd></div>
      {preview.discountTotal > 0 && <div className="flex justify-between text-ok"><dt>Discount{preview.discountName ? ` · ${preview.discountName}` : ''}</dt><dd className="num">− {inr(preview.discountTotal)}</dd></div>}
      <div className="flex justify-between text-muted"><dt>Taxable value</dt><dd className="num">{inr(preview.subtotal - preview.discountTotal)}</dd></div>
      {intra ? <>
        <div className="flex justify-between text-muted"><dt className="micro self-center">CGST</dt><dd className="num">{inr(cgst)}</dd></div>
        <div className="flex justify-between text-muted"><dt className="micro self-center">SGST</dt><dd className="num">{inr(sgst)}</dd></div>
      </> : <div className="flex justify-between text-muted"><dt className="micro self-center">IGST</dt><dd className="num">{inr(igst)}</dd></div>}
      <div className="flex justify-between pt-2 border-t border-line text-[16px] font-semibold text-plum-dark"><dt>Total</dt><dd className="num">{inr(preview.total)}</dd></div>
    </dl>
  );
}

export default function SubscriptionDetail({ portal }) {
  const { id } = useParams();
  const { data, error } = useQuery(() => api.subscription(id), [id]);
  const { data: lk } = useQuery(() => api.lookups(), []);
  const { exec, busy } = useAction();
  const [confirming, setConfirming] = useState(null);
  const base = portal ? '/portal' : '/app';
  if (error) return <Empty title="Subscription not found" action={<Link to={portal ? '/portal' : '/app/subscriptions'} className="btn-secondary">Back</Link>} />;
  if (!data || !lk) return <Loading rows={10} />;
  const { sub, plan, customer, preview, actions, invoices, events, template } = data;
  const doAction = (a) => exec(() => api.transition(sub.id, a), ACTIONS[a].ok);
  const editable = !portal && ['DRAFT', 'QUOTATION'].includes(sub.state);

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3">{sub.number}<Status value={sub.state} /></span>}
        subtitle={`${customer.name} · ${plan.name} (${periodLabel[plan.period]})`}
        crumbs={portal ? [{ label: 'My subscriptions', to: '/portal' }, { label: sub.number }] : [{ label: 'Subscriptions', to: '/app/subscriptions' }, { label: sub.number }]}
        actions={<>
          {editable && <Link to={`/app/subscriptions/${sub.id}/edit`} className="btn-secondary"><Pencil size={14} />Edit</Link>}
          {actions.map((a) => { const A = ACTIONS[a]; return <button key={a} className={A.cls} disabled={busy} onClick={() => (A.confirm ? setConfirming(a) : doAction(a))}><A.icon size={14} />{A.label}</button>; })}
        </>}
      />
      {!portal && <div className="mb-4 overflow-x-auto"><StatusBar state={sub.state} /></div>}
      {sub.state === 'QUOTATION' && sub.validUntil && (
        <div className={`mb-4 rounded border px-4 py-2.5 text-[13px] flex items-center gap-2 ${sub.validUntil < new Date().toISOString().slice(0, 10) ? 'border-bad/30 bg-bad-bg text-bad' : 'border-warn/30 bg-warn-bg text-[#7a5200]'}`}>
          <Clock size={15} />Quotation valid until {fmtDate(sub.validUntil)}{template && ` · from template “${template.name}”`}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Details" className="lg:col-span-2">
          <KeyValue items={[
            ['Customer', portal ? customer.name : <Link to={`/app/customers/${customer.id}`} className="btn-link">{customer.name}</Link>],
            ['Plan', `${plan.name} · ${inr(plan.price)} per seat, ${periodLabel[plan.period].toLowerCase()}`],
            ['Seats', sub.qty], ['Payment terms', sub.paymentTermsDays ? `Net ${sub.paymentTermsDays} days` : 'Due immediately'],
            ['Start date', fmtDate(sub.startDate)], ['Expiry date', fmtDate(sub.expiryDate)],
            ['Next invoice', sub.state === 'ACTIVE' ? fmtDate(sub.nextBillingDate) : '—'], ['Monthly recurring value', inr(sub.mrr)],
            ...(sub.closeReason ? [['Closed', `${fmtDate(sub.closedOn)} · ${sub.closeReason}`]] : []),
            ...(sub.pausedOn ? [['Paused since', fmtDate(sub.pausedOn)]] : []),
          ]} />
          <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-line text-[12px] text-muted">
            Plan rules: {[plan.pausable && 'pausable', plan.renewable && 'renewable', plan.closable && 'customer can close', plan.autoClose && 'auto-closes at end'].filter(Boolean).join(' · ') || 'none'}
          </div>
        </Card>
        <Card title={sub.state === 'ACTIVE' ? 'Next invoice preview' : 'Price per period'}>
          <TaxBox preview={preview} customer={customer} company={lk.company} />
        </Card>
      </div>

      <Card title="Order lines" pad={false} className="mb-4">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Unit price</th><th className="r">Discount</th><th>Tax</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {preview.lines.map((l, i) => (
                <tr key={i}>
                  <td className="font-medium">{l.description}</td>
                  <td className="r num">{l.qty}</td>
                  <td className="r num">{inr(l.unitPrice)}</td>
                  <td className="r num text-ok">{l.discount ? `− ${inr(l.discount)}` : '—'}</td>
                  <td className="text-[12px]">{l.taxName}</td>
                  <td className="r num font-medium">{inr(l.taxable)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title={`Invoices (${invoices.length})`} pad={false} className="lg:col-span-2">
          <InvoiceTable rows={invoices} base={`${base}/invoices`} showCustomer={false} />
        </Card>
        {!portal && (
          <Card title="Timeline" pad={false}>
            {events.length === 0 ? <Empty title="No activity yet" /> : (
              <ol className="relative px-4 py-3">
                {events.map((e) => (
                  <li key={e.id} className="relative pl-5 pb-3 last:pb-0 border-l border-line ml-1.5">
                    <span className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-plum" />
                    <div className="text-[13px] font-medium">{e.action}</div>
                    {e.detail && <div className="text-[12px] text-muted">{e.detail}</div>}
                    <div className="text-[11px] text-muted">{e.actor} · {fmtDateTime(e.at)}</div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}
      </div>

      {confirming && (
        <Modal open onClose={() => setConfirming(null)} title={`Close ${sub.number}?`}
          footer={<><button className="btn-secondary" onClick={() => setConfirming(null)}>Keep it</button><button className="btn-primary bg-bad hover:bg-bad" onClick={async () => { await doAction(confirming); setConfirming(null); }}>Close subscription</button></>}>
          <p className="text-[14px]">Closing stops all future billing. Past invoices and payments are kept. This cannot be undone.</p>
        </Modal>
      )}
    </>
  );
}
