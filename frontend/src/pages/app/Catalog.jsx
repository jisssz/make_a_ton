import { useState } from 'react';
import { Plus, Pencil, Trash2, Package, Lock } from 'lucide-react';
import { PageHeader, Tabs, Modal, Field, Toggle, Badge, Loading, Empty } from '../../components/ui';
import { useUrlState } from '../../components/shared';
import { api } from '../../data/api';
import { useQuery, useAction, useAuth } from '../../lib/hooks';
import { inr, fmtDate, toPaise, toRupees } from '../../lib/format';
import { periodLabel } from '../../lib/dates';

const PER = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' };
const R = (paise) => (paise != null ? String(toRupees(paise)) : '');

function ProductModal({ product, variants, taxes, onClose }) {
  const { exec, busy } = useAction();
  const [f, setF] = useState(product
    ? { ...product, salesPrice: R(product.salesPrice), costPrice: R(product.costPrice) }
    : { name: '', type: 'Service', salesPrice: '', costPrice: '', notes: '', taxId: 1, active: true });
  const [vars, setVars] = useState(variants.map((v) => ({ ...v, extraPrice: R(v.extraPrice) })));
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.name.trim()) v.name = 'Name is required';
    if (!(Number(f.salesPrice) >= 0) || f.salesPrice === '') v.salesPrice = 'Enter a sales price';
    if (f.costPrice !== '' && Number(f.costPrice) < 0) v.costPrice = 'Cost cannot be negative';
    vars.forEach((x, i) => { if (!x.attribute.trim() || !x.value.trim()) v[`v${i}`] = 'Attribute and value are required'; });
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(async () => {
      const saved = await api.saveRow('products', { ...f, salesPrice: toPaise(f.salesPrice), costPrice: toPaise(f.costPrice), taxId: Number(f.taxId) || null });
      await api.setVariants(saved.id, vars.map((x) => ({ attribute: x.attribute.trim(), value: x.value.trim(), extraPrice: toPaise(x.extraPrice) })));
      return saved;
    }, 'Product saved');
    if (r.ok) onClose();
  };
  const margin = Number(f.salesPrice) ? Math.round(((Number(f.salesPrice) - Number(f.costPrice || 0)) / Number(f.salesPrice)) * 100) : null;
  return (
    <Modal open wide onClose={onClose} title={product ? `Edit ${product.name}` : 'New product'}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" form="prodform" disabled={busy}>Save product</button></>}>
      <form id="prodform" onSubmit={submit} noValidate>
        <div className="grid sm:grid-cols-4 gap-3">
          <Field label="Product name" error={err.name} required className="sm:col-span-2"><input className={`input ${err.name ? 'input-error' : ''}`} value={f.name} onChange={set('name')} /></Field>
          <Field label="Type"><select className="input" value={f.type} onChange={set('type')}>{['Service', 'Software', 'Add-on', 'Goods'].map((t) => <option key={t}>{t}</option>)}</select></Field>
          <Field label="Tax"><select className="input" value={f.taxId || ''} onChange={set('taxId')}>{taxes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Sales price (₹)" error={err.salesPrice} required><input type="number" min="0" step="0.01" className={`input num ${err.salesPrice ? 'input-error' : ''}`} value={f.salesPrice} onChange={set('salesPrice')} /></Field>
          <Field label="Cost price (₹)" error={err.costPrice} hint={margin != null ? `Margin ${margin}%` : ''}><input type="number" min="0" step="0.01" className="input num" value={f.costPrice} onChange={set('costPrice')} /></Field>
          <Field label="Notes" className="sm:col-span-2"><input className="input" value={f.notes} onChange={set('notes')} /></Field>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <div><div className="font-semibold text-[14px]">Variants</div><div className="text-[12px] text-muted">e.g. Brand: Odoo adds ₹560 to the price</div></div>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setVars([...vars, { attribute: vars[0]?.attribute || 'Brand', value: '', extraPrice: '0' }])}><Plus size={14} />Add variant</button>
          </div>
          {vars.length === 0 ? <div className="text-[13px] text-muted border border-dashed border-line rounded p-4 text-center">No variants — the product sells at one price.</div> : (
            <table className="tbl border border-line rounded">
              <thead><tr><th>Attribute</th><th>Value</th><th className="r">Extra price (₹)</th><th className="r">Final price</th><th /></tr></thead>
              <tbody>
                {vars.map((x, i) => (
                  <tr key={i}>
                    <td><input className={`input h-8 ${err[`v${i}`] ? 'input-error' : ''}`} value={x.attribute} onChange={(e) => setVars(vars.map((y, j) => (j === i ? { ...y, attribute: e.target.value } : y)))} aria-label="Attribute" /></td>
                    <td><input className={`input h-8 ${err[`v${i}`] ? 'input-error' : ''}`} value={x.value} onChange={(e) => setVars(vars.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))} aria-label="Value" /></td>
                    <td><input type="number" min="0" className="input h-8 num text-right" value={x.extraPrice} onChange={(e) => setVars(vars.map((y, j) => (j === i ? { ...y, extraPrice: e.target.value } : y)))} aria-label="Extra price" /></td>
                    <td className="r num">{inr(toPaise(f.salesPrice) + toPaise(x.extraPrice))}</td>
                    <td><button type="button" className="text-muted hover:text-bad" onClick={() => setVars(vars.filter((_, j) => j !== i))} aria-label="Remove variant"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </form>
    </Modal>
  );
}

function PlanModal({ plan, taxes, onClose }) {
  const { exec, busy, fieldErrors } = useAction();
  const [f, setF] = useState(plan ? { ...plan, price: R(plan.price) }
    : { name: '', period: 'MONTHLY', price: '', minQty: 1, startDate: '', endDate: '', taxId: 1, autoClose: false, closable: true, pausable: true, renewable: true, active: true });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.name.trim()) v.name = 'Name is required';
    if (f.price === '' || Number(f.price) < 0) v.price = 'Enter a price';
    if (!(Number(f.minQty) >= 1)) v.minQty = 'Minimum quantity must be at least 1';
    if (f.endDate && f.startDate && f.endDate <= f.startDate) v.endDate = 'End date must be after start date';
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(() => api.saveRow('plans', { ...f, price: toPaise(f.price), minQty: Number(f.minQty), taxId: Number(f.taxId) || null, endDate: f.endDate || null, startDate: f.startDate || null }), 'Plan saved');
    if (r.ok) onClose();
  };
  const e2 = { ...fieldErrors, ...err };
  return (
    <Modal open onClose={onClose} title={plan ? `Edit ${plan.name}` : 'New recurring plan'}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" form="planform" disabled={busy}>Save plan</button></>}>
      <form id="planform" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan name" error={e2.name} required className="col-span-2"><input className={`input ${e2.name ? 'input-error' : ''}`} value={f.name} onChange={set('name')} /></Field>
          <Field label="Price per seat / period (₹)" error={e2.price} required><input type="number" min="0" step="0.01" className={`input num ${e2.price ? 'input-error' : ''}`} value={f.price} onChange={set('price')} /></Field>
          <Field label="Bills every" required><select className="input" value={f.period} onChange={set('period')}>{Object.entries(PER).map(([k, l]) => <option key={k} value={k}>{l[0].toUpperCase() + l.slice(1)}</option>)}</select></Field>
          <Field label="Minimum quantity" error={e2.minQty} required><input type="number" min="1" className={`input num ${e2.minQty ? 'input-error' : ''}`} value={f.minQty} onChange={set('minQty')} /></Field>
          <Field label="Tax"><select className="input" value={f.taxId || ''} onChange={set('taxId')}>{taxes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Available from"><input type="date" className="input" value={f.startDate || ''} onChange={set('startDate')} /></Field>
          <Field label="Available until" error={e2.endDate}><input type="date" className={`input ${e2.endDate ? 'input-error' : ''}`} value={f.endDate || ''} onChange={set('endDate')} /></Field>
        </div>
        <div className="border border-line rounded p-3 grid grid-cols-2 gap-3">
          <div className="col-span-2 micro">Lifecycle rules</div>
          <Toggle checked={f.autoClose} onChange={(autoClose) => setF({ ...f, autoClose })} label="Auto-close when it ends" />
          <Toggle checked={f.closable} onChange={(closable) => setF({ ...f, closable })} label="Customer can close early" />
          <Toggle checked={f.pausable} onChange={(pausable) => setF({ ...f, pausable })} label="Can be paused" />
          <Toggle checked={f.renewable} onChange={(renewable) => setF({ ...f, renewable })} label="Can be renewed" />
        </div>
      </form>
    </Modal>
  );
}

function TaxModal({ tax, onClose }) {
  const { exec, busy } = useAction();
  const [f, setF] = useState(tax || { name: '', rate: '', type: 'GST', active: true });
  const [err, setErr] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.name.trim()) v.name = 'Name is required';
    if (f.rate === '' || Number(f.rate) < 0 || Number(f.rate) > 100) v.rate = 'Rate must be 0–100';
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(() => api.saveRow('taxes', { ...f, rate: Number(f.rate) }), 'Tax rule saved');
    if (r.ok) onClose();
  };
  return (
    <Modal open onClose={onClose} title={tax ? 'Edit tax rule' : 'New tax rule'}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" form="taxform" disabled={busy}>Save</button></>}>
      <form id="taxform" onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate>
        <Field label="Name" error={err.name} required className="col-span-2"><input className={`input ${err.name ? 'input-error' : ''}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Rate (%)" error={err.rate} required><input type="number" step="0.01" className={`input num ${err.rate ? 'input-error' : ''}`} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></Field>
        <Field label="Type"><select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option>GST</option><option>Exempt</option><option>Other</option></select></Field>
        <p className="col-span-2 text-[12px] text-muted bg-canvas rounded p-2.5">GST is split automatically on invoices: CGST + SGST for customers in Kerala, IGST for other states.</p>
      </form>
    </Modal>
  );
}

function DiscountModal({ discount, products, onClose }) {
  const { exec, busy } = useAction();
  const [f, setF] = useState(discount
    ? { ...discount, value: discount.kind === 'FIXED' ? R(discount.value) : String(discount.value), minAmount: R(discount.minAmount) }
    : { name: '', kind: 'PERCENT', value: '', minAmount: '', minQty: '', startDate: '', endDate: '', usageLimit: '', scope: 'SUBSCRIPTION', productId: '', active: true });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.name.trim()) v.name = 'Name is required';
    if (!(Number(f.value) > 0)) v.value = 'Enter a value above 0';
    else if (f.kind === 'PERCENT' && Number(f.value) > 100) v.value = 'Percentage cannot exceed 100';
    if (!f.startDate) v.startDate = 'Start date is required';
    if (!f.endDate) v.endDate = 'End date is required';
    else if (f.startDate && f.endDate < f.startDate) v.endDate = 'End date must be after start date';
    if (f.scope === 'PRODUCT' && !f.productId) v.productId = 'Choose a product';
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(() => api.saveRow('discounts', {
      ...f, value: f.kind === 'FIXED' ? toPaise(f.value) : Number(f.value), minAmount: toPaise(f.minAmount), minQty: Number(f.minQty || 0),
      usageLimit: Number(f.usageLimit || 0), productId: f.scope === 'PRODUCT' ? Number(f.productId) : null,
    }), 'Discount rule saved');
    if (r.ok) onClose();
  };
  return (
    <Modal open onClose={onClose} title={discount ? `Edit ${discount.name}` : 'New discount rule'}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" form="discform" disabled={busy}>Save discount</button></>}>
      <form id="discform" onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate>
        <Field label="Name" error={err.name} required className="col-span-2"><input className={`input ${err.name ? 'input-error' : ''}`} value={f.name} onChange={set('name')} /></Field>
        <Field label="Type"><select className="input" value={f.kind} onChange={set('kind')}><option value="PERCENT">Percentage (%)</option><option value="FIXED">Fixed amount (₹)</option></select></Field>
        <Field label={f.kind === 'PERCENT' ? 'Discount (%)' : 'Discount (₹)'} error={err.value} required><input type="number" min="0" step="0.01" className={`input num ${err.value ? 'input-error' : ''}`} value={f.value} onChange={set('value')} /></Field>
        <Field label="Minimum purchase (₹)" hint="Invoice subtotal before discount"><input type="number" min="0" className="input num" value={f.minAmount} onChange={set('minAmount')} /></Field>
        <Field label="Minimum quantity"><input type="number" min="0" className="input num" value={f.minQty} onChange={set('minQty')} /></Field>
        <Field label="Starts" error={err.startDate} required><input type="date" className={`input ${err.startDate ? 'input-error' : ''}`} value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label="Ends" error={err.endDate} required><input type="date" className={`input ${err.endDate ? 'input-error' : ''}`} value={f.endDate} onChange={set('endDate')} /></Field>
        <Field label="Usage limit" hint="Leave empty for unlimited"><input type="number" min="0" className="input num" value={f.usageLimit || ''} onChange={set('usageLimit')} /></Field>
        <Field label="Applies to"><select className="input" value={f.scope} onChange={set('scope')}><option value="SUBSCRIPTION">Whole subscription</option><option value="PRODUCT">A specific product</option></select></Field>
        {f.scope === 'PRODUCT' && <Field label="Product" error={err.productId} required className="col-span-2"><select className={`input ${err.productId ? 'input-error' : ''}`} value={f.productId || ''} onChange={set('productId')}><option value="">Choose…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
        <div className="col-span-2"><Toggle checked={f.active} onChange={(active) => setF({ ...f, active })} label="Active" /></div>
        <p className="col-span-2 text-[12px] text-muted bg-canvas rounded p-2.5">Applied automatically on the next invoice, before tax. One discount per invoice — the best eligible one wins. Stops when it expires or reaches its usage limit.</p>
      </form>
    </Modal>
  );
}

export default function Catalog() {
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [st, set] = useUrlState({ tab: 'products' });
  const [edit, setEdit] = useState(null); // { kind, row }
  const { data } = useQuery(() => api.lookups(), []);
  if (!data) return <Loading rows={8} />;
  const today = new Date().toISOString().slice(0, 10);
  const newBtn = {
    products: ['New product', 'product'], plans: ['New plan', 'plan'], taxes: ['New tax rule', 'tax'], discounts: ['New discount', 'discount'],
  }[st.tab];
  const editBtn = (kind, row) => isAdmin && <button className="text-muted hover:text-plum" onClick={(e) => { e.stopPropagation(); setEdit({ kind, row }); }} aria-label="Edit"><Pencil size={15} /></button>;

  return (
    <>
      <PageHeader title="Products & Plans" subtitle="What you sell, how often it bills, and the tax and discount rules applied."
        actions={isAdmin ? <button className="btn-primary" onClick={() => setEdit({ kind: newBtn[1], row: null })}><Plus size={15} />{newBtn[0]}</button>
          : <span className="inline-flex items-center gap-1.5 text-[12px] text-muted"><Lock size={13} />Only admins can change these</span>} />
      <Tabs value={st.tab} onChange={(tab) => set({ tab })} tabs={[
        { value: 'products', label: 'Products', count: data.products.length }, { value: 'plans', label: 'Recurring plans', count: data.plans.length },
        { value: 'taxes', label: 'Taxes', count: data.taxes.length }, { value: 'discounts', label: 'Discounts', count: data.discounts.length },
      ]} />

      {st.tab === 'products' && (
        <div className="table-wrap">
          {data.products.length === 0 ? <Empty icon={Package} title="No products yet" /> : (
            <table className="tbl">
              <thead><tr><th>Product</th><th>Type</th><th className="r">Sales price</th><th className="r">Cost price</th><th>Variants</th><th>Tax</th><th /></tr></thead>
              <tbody>
                {data.products.map((p) => {
                  const vs = data.variants.filter((v) => v.productId === p.id);
                  return (
                    <tr key={p.id}>
                      <td><div className="font-medium">{p.name}</div><div className="text-[12px] text-muted">{p.notes}</div></td>
                      <td>{p.type}</td>
                      <td className="r num">{inr(p.salesPrice)}</td>
                      <td className="r num text-muted">{inr(p.costPrice)}</td>
                      <td>{vs.length ? <div className="flex flex-wrap gap-1">{vs.map((v) => <Badge key={v.id} tone="plum">{v.value}{v.extraPrice ? ` +₹${toRupees(v.extraPrice)}` : ''}</Badge>)}</div> : <span className="text-muted">—</span>}</td>
                      <td>{data.taxes.find((t) => t.id === p.taxId)?.name || '—'}</td>
                      <td>{editBtn('product', p)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {st.tab === 'plans' && (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.plans.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div><div className="font-semibold text-[16px]">{p.name}</div><div className="text-[12px] text-muted">{periodLabel[p.period]} billing · min {p.minQty} seat{p.minQty > 1 ? 's' : ''}</div></div>
                {editBtn('plan', p)}
              </div>
              <div className="mt-3 text-[26px] font-semibold num">{inr(p.price)}<span className="text-[13px] text-muted font-normal"> / seat / {PER[p.period]}</span></div>
              <div className="text-[12px] text-muted mt-1">Available {p.startDate ? fmtDate(p.startDate) : 'now'}{p.endDate ? ` – ${fmtDate(p.endDate)}` : ', no end date'}</div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Badge tone={p.autoClose ? 'plum' : 'gray'}>{p.autoClose ? 'Auto-close' : 'No auto-close'}</Badge>
                <Badge tone={p.closable ? 'teal' : 'gray'}>{p.closable ? 'Closable' : 'Not closable'}</Badge>
                <Badge tone={p.pausable ? 'teal' : 'gray'}>{p.pausable ? 'Pausable' : 'Not pausable'}</Badge>
                <Badge tone={p.renewable ? 'green' : 'gray'}>{p.renewable ? 'Renewable' : 'Not renewable'}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {st.tab === 'taxes' && (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Tax rule</th><th>Type</th><th className="r">Rate</th><th>Within Kerala</th><th>Other states</th><th /></tr></thead>
            <tbody>
              {data.taxes.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.name}</td><td>{t.type}</td><td className="r num">{t.rate}%</td>
                  <td className="text-[12px]">{t.rate ? `CGST ${t.rate / 2}% + SGST ${t.rate / 2}%` : '—'}</td>
                  <td className="text-[12px]">{t.rate ? `IGST ${t.rate}%` : '—'}</td>
                  <td>{editBtn('tax', t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {st.tab === 'discounts' && (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Discount</th><th>Value</th><th>Conditions</th><th>Valid</th><th>Applies to</th><th className="r">Used</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.discounts.map((d) => {
                const expired = d.endDate && d.endDate < today;
                const exhausted = d.usageLimit && d.timesUsed >= d.usageLimit;
                return (
                  <tr key={d.id}>
                    <td className="font-medium">{d.name}</td>
                    <td className="num">{d.kind === 'PERCENT' ? `${d.value}%` : inr(d.value)}</td>
                    <td className="text-[12px] text-muted">{[d.minAmount ? `Min ${inr(d.minAmount)}` : null, d.minQty ? `Min qty ${d.minQty}` : null].filter(Boolean).join(' · ') || 'None'}</td>
                    <td className="text-[12px] num">{fmtDate(d.startDate)} – {fmtDate(d.endDate)}</td>
                    <td>{d.scope === 'PRODUCT' ? data.products.find((p) => p.id === d.productId)?.name : 'Whole subscription'}</td>
                    <td className="r num">{d.timesUsed}{d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>
                    <td>{!d.active ? <Badge>Off</Badge> : expired ? <Badge tone="red">Expired</Badge> : exhausted ? <Badge tone="amber">Limit reached</Badge> : <Badge tone="green">Active</Badge>}</td>
                    <td>{editBtn('discount', d)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {edit?.kind === 'product' && <ProductModal product={edit.row} variants={edit.row ? data.variants.filter((v) => v.productId === edit.row.id) : []} taxes={data.taxes} onClose={() => setEdit(null)} />}
      {edit?.kind === 'plan' && <PlanModal plan={edit.row} taxes={data.taxes} onClose={() => setEdit(null)} />}
      {edit?.kind === 'tax' && <TaxModal tax={edit.row} onClose={() => setEdit(null)} />}
      {edit?.kind === 'discount' && <DiscountModal discount={edit.row} products={data.products} onClose={() => setEdit(null)} />}
    </>
  );
}
