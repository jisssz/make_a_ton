import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Info } from 'lucide-react';
import { PageHeader, Card, Field, Loading } from '../../components/ui';
import { api } from '../../data/api';
import { useQuery, useAction } from '../../lib/hooks';
import { inr, toPaise, toRupees } from '../../lib/format';
import { periodLabel, todayIST, addMonthsAnchored } from '../../lib/dates';

const emptyForm = (customerId) => ({ customerId: customerId || '', planId: '', qty: 1, startDate: todayIST(), expiryDate: '', paymentTermsDays: 15, templateId: '', lines: [] });

export default function SubscriptionForm() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { data: lk } = useQuery(() => api.lookups(), []);
  const { exec, busy, fieldErrors } = useAction();
  const [f, setF] = useState(null);
  const [err, setErr] = useState({});

  useEffect(() => {
    (async () => {
      if (id) {
        const d = await api.subscription(id);
        const s = d.sub;
        setF({ ...s, expiryDate: s.expiryDate || '', lines: s.lines.map((l) => ({ ...l, unitPrice: String(toRupees(l.unitPrice)), variantId: l.variantId || '', taxId: l.taxId || '' })) });
      } else if (sp.get('templateId')) {
        const d = await api.draftFromTemplate(Number(sp.get('templateId')));
        setF({ ...emptyForm(sp.get('customerId')), ...d, lines: d.lines.map((l) => ({ ...l, unitPrice: String(toRupees(l.unitPrice)) })) });
      } else setF(emptyForm(sp.get('customerId')));
    })();
  }, [id, sp]);

  if (!lk || !f) return <Loading rows={8} />;
  const plan = lk.plans.find((p) => p.id === Number(f.planId));
  const customer = lk.customers.find((c) => c.id === Number(f.customerId));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setLine = (i, patch) => setF({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const applyTemplate = async (tid) => {
    if (!tid) { setF({ ...f, templateId: '' }); return; }
    const d = await api.draftFromTemplate(Number(tid));
    setF({ ...f, ...d, startDate: f.startDate, customerId: f.customerId, lines: d.lines.map((l) => ({ ...l, unitPrice: String(toRupees(l.unitPrice)) })) });
  };
  const pickProduct = (i, productId) => {
    const p = lk.products.find((x) => x.id === Number(productId));
    setLine(i, { productId, variantId: '', unitPrice: p ? String(toRupees(p.salesPrice)) : '', taxId: p?.taxId || '' });
  };
  const pickVariant = (i, variantId) => {
    const l = f.lines[i];
    const p = lk.products.find((x) => x.id === Number(l.productId));
    const v = lk.variants.find((x) => x.id === Number(variantId));
    setLine(i, { variantId, unitPrice: String(toRupees((p?.salesPrice || 0) + (v?.extraPrice || 0))) });
  };

  // Live preview (discounts are added automatically when the invoice is created)
  const taxRate = (tid) => lk.taxes.find((t) => t.id === Number(tid))?.rate || 0;
  const rows = [
    ...(plan ? [{ label: `${plan.name} plan × ${f.qty || 0}`, base: plan.price * Number(f.qty || 0), rate: taxRate(plan.taxId) }] : []),
    ...f.lines.filter((l) => l.productId).map((l) => ({ label: `${lk.products.find((p) => p.id === Number(l.productId))?.name} × ${l.qty}`, base: toPaise(l.unitPrice) * Number(l.qty || 0), rate: taxRate(l.taxId) })),
  ];
  const subtotal = rows.reduce((a, r) => a + r.base, 0);
  const tax = rows.reduce((a, r) => a + Math.round((r.base * r.rate) / 100), 0);
  const intra = customer?.state === lk.company.state;

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.customerId) v.customerId = 'Choose a customer';
    if (!f.planId) v.planId = 'Choose a plan';
    if (plan && Number(f.qty) < plan.minQty) v.qty = `This plan needs at least ${plan.minQty}`;
    if (!f.startDate) v.startDate = 'Start date is required';
    if (f.expiryDate && f.expiryDate <= f.startDate) v.expiryDate = 'Expiry must be after the start date';
    f.lines.forEach((l, i) => { if (!l.productId || !(Number(l.qty) > 0) || Number(l.unitPrice) < 0 || l.unitPrice === '') v[`line${i}`] = 'Choose a product, quantity and price'; });
    setErr(v);
    if (Object.keys(v).length) return;
    const payload = {
      ...f, customerId: Number(f.customerId), planId: Number(f.planId), qty: Number(f.qty),
      lines: f.lines.map((l) => ({ ...l, unitPrice: toPaise(l.unitPrice) })),
    };
    const r = await exec(() => api.saveSubscription(payload), (s) => `${s.number} saved as ${s.state === 'DRAFT' ? 'a draft' : s.state.toLowerCase()}`);
    if (r.ok) nav(`/app/subscriptions/${r.result.id}`);
  };
  const e2 = { ...fieldErrors, ...err };

  return (
    <>
      <PageHeader title={id ? `Edit ${f.number}` : 'New quotation'} subtitle={id ? 'Only draft and quotation subscriptions can be edited.' : 'It starts as a Draft. Send it as a quotation, then confirm and activate.'}
        crumbs={[{ label: 'Subscriptions', to: '/app/subscriptions' }, { label: id ? f.number : 'New' }]} />
      <form onSubmit={submit} noValidate className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {!id && (
            <Card title="Start from a template">
              <div className="flex flex-wrap gap-2">
                {lk.templates.map((t) => (
                  <button type="button" key={t.id} onClick={() => applyTemplate(String(t.id))} className={`btn-sm ${String(f.templateId) === String(t.id) ? 'btn-primary' : 'btn-secondary'}`}>{t.name}</button>
                ))}
                {f.templateId && <button type="button" className="btn-link" onClick={() => applyTemplate('')}>Clear</button>}
              </div>
            </Card>
          )}
          <Card title="Customer & plan">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Customer" error={e2.customerId} required>
                <select className={`input ${e2.customerId ? 'input-error' : ''}`} value={f.customerId} onChange={set('customerId')}>
                  <option value="">Choose a customer…</option>{lk.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Recurring plan" error={e2.planId} required>
                <select className={`input ${e2.planId ? 'input-error' : ''}`} value={f.planId} onChange={(e) => { const p = lk.plans.find((x) => x.id === Number(e.target.value)); setF({ ...f, planId: e.target.value, qty: Math.max(Number(f.qty) || 1, p?.minQty || 1) }); }}>
                  <option value="">Choose a plan…</option>{lk.plans.map((p) => <option key={p.id} value={p.id}>{p.name} · {inr(p.price)} {periodLabel[p.period].toLowerCase()}</option>)}
                </select>
              </Field>
              <Field label="Seats / quantity" error={e2.qty} hint={plan ? `Minimum ${plan.minQty}` : ''} required>
                <input type="number" min={plan?.minQty || 1} className={`input num ${e2.qty ? 'input-error' : ''}`} value={f.qty} onChange={set('qty')} />
              </Field>
              <Field label="Payment terms">
                <select className="input" value={f.paymentTermsDays} onChange={set('paymentTermsDays')}>{[0, 7, 15, 30, 45].map((d) => <option key={d} value={d}>{d ? `Net ${d} days` : 'Due immediately'}</option>)}</select>
              </Field>
              <Field label="Start date" error={e2.startDate} required><input type="date" className={`input ${e2.startDate ? 'input-error' : ''}`} value={f.startDate} onChange={set('startDate')} /></Field>
              <Field label="Expiry date" error={e2.expiryDate}>
                <div className="flex gap-2">
                  <input type="date" className={`input ${e2.expiryDate ? 'input-error' : ''}`} value={f.expiryDate} onChange={set('expiryDate')} />
                  <button type="button" className="btn-secondary" onClick={() => setF({ ...f, expiryDate: addMonthsAnchored(f.startDate, 12, Number(f.startDate.slice(8))) })}>+1 yr</button>
                </div>
              </Field>
            </div>
          </Card>
          <Card title="Product lines" action={<button type="button" className="btn-secondary btn-sm" onClick={() => setF({ ...f, lines: [...f.lines, { productId: '', variantId: '', qty: 1, unitPrice: '', taxId: '' }] })}><Plus size={14} />Add line</button>} pad={false}>
            {f.lines.length === 0 ? <div className="p-6 text-center text-[13px] text-muted">Only the plan will be billed. Add products such as add-ons or support.</div> : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Product</th><th>Variant</th><th className="r">Qty</th><th className="r">Unit price (₹)</th><th>Tax</th><th className="r">Amount</th><th /></tr></thead>
                  <tbody>
                    {f.lines.map((l, i) => {
                      const vs = lk.variants.filter((v) => v.productId === Number(l.productId));
                      const bad = e2[`line${i}`];
                      return (
                        <tr key={i}>
                          <td className="min-w-[160px]"><select className={`input h-8 ${bad ? 'input-error' : ''}`} value={l.productId} onChange={(e) => pickProduct(i, e.target.value)} aria-label="Product"><option value="">Choose…</option>{lk.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
                          <td className="min-w-[130px]"><select className="input h-8" value={l.variantId} onChange={(e) => pickVariant(i, e.target.value)} disabled={!vs.length} aria-label="Variant"><option value="">{vs.length ? 'Standard' : '—'}</option>{vs.map((v) => <option key={v.id} value={v.id}>{v.value}{v.extraPrice ? ` (+₹${toRupees(v.extraPrice)})` : ''}</option>)}</select></td>
                          <td><input type="number" min="1" className="input h-8 num text-right w-16" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} aria-label="Quantity" /></td>
                          <td><input type="number" min="0" step="0.01" className="input h-8 num text-right w-28" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} aria-label="Unit price" /></td>
                          <td className="min-w-[120px]"><select className="input h-8" value={l.taxId} onChange={(e) => setLine(i, { taxId: e.target.value })} aria-label="Tax"><option value="">No tax</option>{lk.taxes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></td>
                          <td className="r num">{inr(toPaise(l.unitPrice) * Number(l.qty || 0))}</td>
                          <td><button type="button" className="text-muted hover:text-bad" onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })} aria-label="Remove line"><Trash2 size={15} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div>
          <div className="card p-4 lg:sticky lg:top-[68px]">
            <div className="micro mb-3">Each {plan ? periodLabel[plan.period].toLowerCase().replace('ly', '').replace('dai', 'day') : 'period'}</div>
            <ul className="space-y-1.5 text-[13px] mb-3">
              {rows.map((r, i) => <li key={i} className="flex justify-between gap-3"><span className="text-muted truncate">{r.label}</span><span className="num">{inr(r.base)}</span></li>)}
              {!rows.length && <li className="text-muted">Choose a plan to see pricing.</li>}
            </ul>
            <div className="border-t border-line pt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span>Subtotal</span><span className="num">{inr(subtotal)}</span></div>
              {intra ? <>
                <div className="flex justify-between text-muted"><span>CGST</span><span className="num">{inr(Math.round(tax / 2))}</span></div>
                <div className="flex justify-between text-muted"><span>SGST</span><span className="num">{inr(tax - Math.round(tax / 2))}</span></div>
              </> : <div className="flex justify-between text-muted"><span>IGST</span><span className="num">{inr(tax)}</span></div>}
              <div className="flex justify-between pt-2 border-t border-line text-[16px] font-semibold text-plum-dark"><span>Total</span><span className="num">{inr(subtotal + tax)}</span></div>
            </div>
            <p className="flex gap-2 text-[12px] text-muted bg-canvas rounded p-2.5 mt-3"><Info size={14} className="shrink-0 mt-0.5" />Eligible discounts are applied automatically before tax when the invoice is created.</p>
            <button className="btn-primary w-full mt-4 h-10" disabled={busy}>{id ? 'Save changes' : 'Save as draft'}</button>
            <button type="button" className="btn-secondary w-full mt-2" onClick={() => nav(-1)}>Cancel</button>
          </div>
        </div>
      </form>
    </>
  );
}
