import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FilePlus2, Pencil, Trash2, FileText } from 'lucide-react';
import { PageHeader, Card, Modal, Field, Loading, Status, Empty, Badge } from '../../components/ui';
import { api } from '../../data/api';
import { useQuery, useAction } from '../../lib/hooks';
import { inr, fmtDate } from '../../lib/format';
import { periodLabel, todayIST } from '../../lib/dates';

function TemplateModal({ template, lk, onClose }) {
  const { exec, busy } = useAction();
  const [f, setF] = useState(template || { name: '', planId: lk.plans[0]?.id, qty: 1, validityDays: 15, paymentTermsDays: 15, durationMonths: 12, lines: [], notes: '' });
  const [err, setErr] = useState({});
  const plan = lk.plans.find((p) => p.id === Number(f.planId));
  const setLine = (i, patch) => setF({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.name.trim()) v.name = 'Name is required';
    if (!(Number(f.validityDays) >= 1)) v.validityDays = 'At least 1 day';
    if (plan && Number(f.qty) < plan.minQty) v.qty = `Plan needs at least ${plan.minQty}`;
    f.lines.forEach((l, i) => { if (!l.productId || !(Number(l.qty) > 0)) v[`l${i}`] = 'Choose a product and quantity'; });
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(() => api.saveRow('templates', {
      ...f, planId: Number(f.planId), qty: Number(f.qty), validityDays: Number(f.validityDays), paymentTermsDays: Number(f.paymentTermsDays), durationMonths: Number(f.durationMonths) || 0,
      lines: f.lines.map((l) => ({ productId: Number(l.productId), variantId: l.variantId ? Number(l.variantId) : null, qty: Number(l.qty) })),
    }), 'Template saved');
    if (r.ok) onClose();
  };
  return (
    <Modal open wide onClose={onClose} title={template ? `Edit ${template.name}` : 'New quotation template'}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" form="tplform" disabled={busy}>Save template</button></>}>
      <form id="tplform" onSubmit={submit} noValidate>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Template name" error={err.name} required className="sm:col-span-2"><input className={`input ${err.name ? 'input-error' : ''}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Recurring plan" required><select className="input" value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })}>{lk.plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {periodLabel[p.period]}</option>)}</select></Field>
          <Field label="Seats" error={err.qty}><input type="number" min="1" className={`input num ${err.qty ? 'input-error' : ''}`} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
          <Field label="Quote valid for (days)" error={err.validityDays} required><input type="number" min="1" className={`input num ${err.validityDays ? 'input-error' : ''}`} value={f.validityDays} onChange={(e) => setF({ ...f, validityDays: e.target.value })} /></Field>
          <Field label="Payment terms (days)"><select className="input" value={f.paymentTermsDays} onChange={(e) => setF({ ...f, paymentTermsDays: e.target.value })}>{[0, 7, 15, 30, 45].map((d) => <option key={d} value={d}>{d ? `Net ${d}` : 'Due immediately'}</option>)}</select></Field>
          <Field label="Contract length (months)" hint="Sets the expiry date"><input type="number" min="0" className="input num" value={f.durationMonths} onChange={(e) => setF({ ...f, durationMonths: e.target.value })} /></Field>
          <Field label="Notes" className="sm:col-span-2"><input className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <div className="flex items-center justify-between mt-5 mb-2">
          <div className="font-semibold text-[14px]">Product lines</div>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setF({ ...f, lines: [...f.lines, { productId: '', variantId: '', qty: 1 }] })}><Plus size={14} />Add line</button>
        </div>
        {f.lines.length === 0 ? <div className="text-[13px] text-muted border border-dashed border-line rounded p-4 text-center">Plan only — add products like add-ons or support.</div> : (
          <table className="tbl border border-line">
            <thead><tr><th>Product</th><th>Variant</th><th className="r">Qty</th><th /></tr></thead>
            <tbody>{f.lines.map((l, i) => {
              const vs = lk.variants.filter((v) => v.productId === Number(l.productId));
              return (
                <tr key={i}>
                  <td><select className={`input h-8 ${err[`l${i}`] ? 'input-error' : ''}`} value={l.productId} onChange={(e) => setLine(i, { productId: e.target.value, variantId: '' })} aria-label="Product"><option value="">Choose…</option>{lk.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                  <td><select className="input h-8" value={l.variantId || ''} onChange={(e) => setLine(i, { variantId: e.target.value })} disabled={!vs.length} aria-label="Variant"><option value="">{vs.length ? 'Standard' : '—'}</option>{vs.map((v) => <option key={v.id} value={v.id}>{v.attribute}: {v.value}</option>)}</select></td>
                  <td><input type="number" min="1" className="input h-8 num text-right w-20 ml-auto" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label="Quantity" /></td>
                  <td><button type="button" className="text-muted hover:text-bad" onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })} aria-label="Remove line"><Trash2 size={15} /></button></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </form>
    </Modal>
  );
}

export default function Quotations() {
  const nav = useNavigate();
  const [edit, setEdit] = useState(undefined);
  const { data: lk } = useQuery(() => api.lookups(), []);
  const { data: pipe } = useQuery(async () => {
    const [d, q, c] = await Promise.all([api.subscriptions({ state: 'DRAFT' }), api.subscriptions({ state: 'QUOTATION' }), api.subscriptions({ state: 'CONFIRMED' })]);
    return { DRAFT: d.rows, QUOTATION: q.rows, CONFIRMED: c.rows };
  }, []);
  if (!lk || !pipe) return <Loading rows={8} />;
  const today = todayIST();
  const cols = [['DRAFT', 'Draft', 'Being prepared'], ['QUOTATION', 'Sent', 'Waiting for the customer'], ['CONFIRMED', 'Confirmed', 'Ready to activate']];

  return (
    <>
      <PageHeader title="Quotations" subtitle="Start from a template, send the quote, and turn it into a subscription."
        actions={<><button className="btn-secondary" onClick={() => setEdit(null)}><FilePlus2 size={15} />New template</button><Link to="/app/subscriptions/new" className="btn-primary"><Plus size={15} />New quotation</Link></>} />

      <h2 className="micro mb-2">Templates</h2>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {lk.templates.map((t) => {
          const plan = lk.plans.find((p) => p.id === t.planId);
          return (
            <div key={t.id} className="card p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-semibold">{t.name}</div><div className="text-[12px] text-muted">{t.notes}</div></div>
                <button className="text-muted hover:text-plum" onClick={() => setEdit(t)} aria-label="Edit template"><Pencil size={15} /></button>
              </div>
              <ul className="mt-3 text-[13px] space-y-1 flex-1">
                <li><span className="text-muted">Plan:</span> {plan?.name} · {t.qty} seat{t.qty > 1 ? 's' : ''} · {plan && inr(plan.price)} each</li>
                {t.lines.map((l, i) => { const p = lk.products.find((x) => x.id === l.productId); const v = lk.variants.find((x) => x.id === l.variantId); return <li key={i}><span className="text-muted">+</span> {p?.name}{v ? ` (${v.value})` : ''} × {l.qty}</li>; })}
              </ul>
              <div className="flex items-center gap-1.5 mt-3"><Badge tone="plum">Valid {t.validityDays} days</Badge><Badge>{t.paymentTermsDays ? `Net ${t.paymentTermsDays}` : 'Due now'}</Badge></div>
              <button className="btn-primary mt-3" onClick={() => nav(`/app/subscriptions/new?templateId=${t.id}`)}>Use template</button>
            </div>
          );
        })}
      </div>

      <h2 className="micro mb-2">Pipeline</h2>
      <div className="grid lg:grid-cols-3 gap-4">
        {cols.map(([state, label, hint]) => (
          <Card key={state} title={<span className="flex items-center gap-2">{label}<span className="text-[11px] bg-canvas border border-line rounded px-1.5 num">{pipe[state].length}</span></span>} action={<span className="text-[12px] text-muted">{hint}</span>} pad={false}>
            {pipe[state].length === 0 ? <Empty icon={FileText} title="Nothing here" /> : pipe[state].map((s) => {
              const expired = s.validUntil && s.validUntil < today;
              return (
                <Link key={s.id} to={`/app/subscriptions/${s.id}`} className="block px-4 py-3 border-b border-line last:border-0 hover:bg-canvas">
                  <div className="flex items-center justify-between"><span className="font-medium text-plum">{s.number}</span><Status value={s.state} /></div>
                  <div className="text-[13px] mt-0.5">{s.customer}</div>
                  <div className="text-[12px] text-muted flex justify-between mt-0.5"><span>{s.plan} · {s.qty} seat{s.qty > 1 ? 's' : ''}</span><span className="num">{inr(s.mrr)}/mo</span></div>
                  {s.validUntil && <div className={`text-[12px] mt-1 ${expired ? 'text-bad' : 'text-warn'}`}>{expired ? 'Expired' : 'Valid until'} {fmtDate(s.validUntil)}</div>}
                </Link>
              );
            })}
          </Card>
        ))}
      </div>
      {edit !== undefined && <TemplateModal template={edit} lk={lk} onClose={() => setEdit(undefined)} />}
    </>
  );
}
