import { useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Users, Search, ShieldCheck, AlertTriangle, AlertCircle, Sparkles, TrendingUp, HeartHandshake } from 'lucide-react';
import { PageHeader, Card, Pagination, Modal, Field, Loading, Empty, KeyValue, Tabs } from '../../components/ui';
import { SubscriptionTable, InvoiceTable, RecordPaymentModal, useUrlState } from '../../components/shared';
import { api } from '../../data/api';
import { useQuery, useAction } from '../../lib/hooks';
import { inr, inr0, fmtDate, initials } from '../../lib/format';
import { EMAIL_RE } from '../../lib/validate';
import { calculateCustomerHealth } from '../../lib/churn';

const STATES = ['Kerala', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 'Telangana', 'Delhi', 'Rajasthan', 'West Bengal', 'Gujarat', 'Other'];

export function CustomerModal({ open, onClose, initial }) {
  const { exec, busy } = useAction();
  const [f, setF] = useState(initial || { name: '', contact: '', email: '', phone: '', city: '', state: 'Kerala', gstin: '' });
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.name.trim()) v.name = 'Company name is required';
    if (!EMAIL_RE.test(f.email)) v.email = 'Enter a valid email address';
    if (f.gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(f.gstin)) v.gstin = 'GSTIN should be 15 characters';
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(() => api.saveCustomer(f), 'Customer saved');
    if (r.ok) onClose(r.result);
  };
  return (
    <Modal open={open} onClose={() => onClose()} title={initial ? 'Edit customer' : 'New customer'}
      footer={<><button className="btn-secondary" onClick={() => onClose()}>Cancel</button><button className="btn-primary" form="custform" disabled={busy}>Save</button></>}>
      <form id="custform" onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate>
        <Field label="Company name" error={err.name} required className="col-span-2"><input className={`input ${err.name ? 'input-error' : ''}`} value={f.name} onChange={set('name')} /></Field>
        <Field label="Contact person"><input className="input" value={f.contact} onChange={set('contact')} /></Field>
        <Field label="Email" error={err.email} required><input type="email" className={`input ${err.email ? 'input-error' : ''}`} value={f.email} onChange={set('email')} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="City"><input className="input" value={f.city} onChange={set('city')} /></Field>
        <Field label="State" hint="Kerala → CGST + SGST; other states → IGST"><select className="input" value={f.state} onChange={set('state')}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="GSTIN" error={err.gstin}><input className={`input uppercase ${err.gstin ? 'input-error' : ''}`} value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} maxLength={15} /></Field>
      </form>
    </Modal>
  );
}

export default function Customers() {
  const [st, set] = useUrlState({ q: '', healthFilter: '' });
  const [creating, setCreating] = useState(false);
  const nav = useNavigate();
  const { data, loading } = useQuery(() => api.customers({ q: st.q, page: st.page }), [st.q, st.page]);

  // Enhance customers with algorithmic health score
  const customersWithHealth = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.map((c) => ({
      ...c,
      health: calculateCustomerHealth(c, [], []),
    }));
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!st.healthFilter) return customersWithHealth;
    if (st.healthFilter === 'at_risk') return customersWithHealth.filter((c) => c.health.score < 60);
    if (st.healthFilter === 'healthy') return customersWithHealth.filter((c) => c.health.score >= 80);
    return customersWithHealth;
  }, [customersWithHealth, st.healthFilter]);

  return (
    <>
      <PageHeader title="Customers" subtitle="Everyone you bill, with predictive health score, recurring value and balance."
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus size={15} />New customer</button>} />

      {/* Filter Tabs for Health and Churn */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => set({ healthFilter: '' })}
          className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors ${
            !st.healthFilter ? 'bg-plum text-white border-plum' : 'bg-white border-line text-charcoal hover:bg-canvas'
          }`}
        >
          All Customers
        </button>
        <button
          onClick={() => set({ healthFilter: 'healthy' })}
          className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors flex items-center gap-1.5 ${
            st.healthFilter === 'healthy' ? 'bg-ok text-white border-ok' : 'bg-white border-line text-charcoal hover:bg-canvas'
          }`}
        >
          <ShieldCheck size={14} className={st.healthFilter === 'healthy' ? 'text-white' : 'text-ok'} />
          Healthy (≥80%)
        </button>
        <button
          onClick={() => set({ healthFilter: 'at_risk' })}
          className={`px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-colors flex items-center gap-1.5 ${
            st.healthFilter === 'at_risk' ? 'bg-bad text-white border-bad' : 'bg-white border-line text-charcoal hover:bg-canvas'
          }`}
        >
          <AlertTriangle size={14} className={st.healthFilter === 'at_risk' ? 'text-white' : 'text-bad'} />
          At Churn Risk (&lt;60%)
        </button>
      </div>

      <div className="card">
        <div className="p-3 border-b border-line flex gap-2">
          <div className="relative flex-1 max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Search name, email or city" value={st.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search customers" /></div>
        </div>
        {loading && !data ? <div className="p-4"><Loading /></div> : filteredRows.length === 0 ? <Empty icon={Users} title="No customers match criteria" /> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr>
                <th>Customer</th>
                <th>Location</th>
                <th className="r">Active subs</th>
                <th className="r">MRR</th>
                <th className="r">Outstanding</th>
                <th className="r">Health Score</th>
              </tr></thead>
              <tbody>
                {filteredRows.map((c) => (
                  <tr key={c.id} className="cursor-pointer" onClick={() => nav(`/app/customers/${c.id}`)}>
                    <td><div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-full bg-plum-subtle text-plum text-[11px] font-semibold flex items-center justify-center shrink-0">{initials(c.name)}</span><div><div className="font-medium">{c.name}</div><div className="text-[12px] text-muted">{c.email}</div></div></div></td>
                    <td>{c.city}{c.city && ', '}{c.state}</td>
                    <td className="r num">{c.activeSubs}</td>
                    <td className="r num">{inr0(c.mrr)}</td>
                    <td className={`r num ${c.outstanding ? 'text-warn font-medium' : 'text-muted'}`}>{inr0(c.outstanding)}</td>
                    <td className="r">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${c.health.badgeClass}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="num font-bold">{c.health.score}%</span>
                        <span className="text-[10px] opacity-80">{c.health.tier}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} size={data.size} total={data.total} onPage={(page) => set({ page })} />}
      {creating && <CustomerModal open onClose={(c) => { setCreating(false); if (c) nav(`/app/customers/${c.id}`); }} />}
    </>
  );
}

export function CustomerDetail() {
  const { id } = useParams();
  const [tab, setTab] = useState('subs');
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(null);
  const { data, error } = useQuery(() => api.customer(id), [id]);
  if (error) return <Empty title="Customer not found" action={<Link to="/app/customers" className="btn-secondary">Back to customers</Link>} />;
  if (!data) return <Loading rows={8} />;
  const { customer: c, subscriptions, invoices, payments } = data;
  const outstanding = invoices.filter((i) => ['CONFIRMED', 'PARTIAL'].includes(i.state)).reduce((a, i) => a + i.balance, 0);
  const mrr = subscriptions.filter((s) => s.state === 'ACTIVE').reduce((a, s) => a + s.mrr, 0);

  // Full algorithmic health score
  const health = calculateCustomerHealth(c, invoices, subscriptions);

  return (
    <>
      <PageHeader title={c.name} crumbs={[{ label: 'Customers', to: '/app/customers' }, { label: c.name }]}
        actions={<><button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button><Link to={`/app/subscriptions/new?customerId=${c.id}`} className="btn-primary"><Plus size={15} />New subscription</Link></>} />
      
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Details" className="lg:col-span-2">
          <KeyValue items={[['Email', c.email], ['Phone', c.phone], ['Contact', c.contact], ['Location', [c.city, c.state].filter(Boolean).join(', ')], ['GSTIN', c.gstin], ['Customer since', fmtDate(c.createdAt)]]} />
        </Card>
        
        {/* Predictive Churn & Health Radar */}
        <Card title="Health & Churn Matrix">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[26px] font-bold num text-charcoal">{health.score}%</div>
                <div className="text-[12px] font-semibold text-muted">{health.tier} · {health.riskLevel}</div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[12px] font-bold border ${health.badgeClass}`}>
                {health.tier}
              </span>
            </div>

            <div className="space-y-1.5 pt-1 text-[11px]">
              <div className="flex justify-between text-muted">
                <span>Payment Reliability</span>
                <span className="font-semibold text-charcoal">{health.breakdown.payment} / 40</span>
              </div>
              <div className="h-1.5 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-ok" style={{ width: `${(health.breakdown.payment / 40) * 100}%` }} />
              </div>

              <div className="flex justify-between text-muted">
                <span>Contract Stability</span>
                <span className="font-semibold text-charcoal">{health.breakdown.subscriptions} / 35</span>
              </div>
              <div className="h-1.5 bg-line rounded-full overflow-hidden">
                <div className="h-full bg-plum" style={{ width: `${(health.breakdown.subscriptions / 35) * 100}%` }} />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-canvas border border-line text-[11px] text-charcoal leading-relaxed">
              <span className="font-semibold text-plum">AI Insight: </span>{health.recommendation}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="card p-4 flex items-center justify-between">
          <div><div className="micro">Monthly Recurring Value</div><div className="text-[22px] font-semibold num">{inr(mrr)}</div></div>
          <span className="p-2.5 rounded-lg bg-plum-subtle text-plum"><TrendingUp size={20} /></span>
        </div>
        <div className="card p-4 flex items-center justify-between">
          <div><div className="micro">Outstanding Balance</div><div className={`text-[22px] font-semibold num ${outstanding ? 'text-warn' : 'text-ok'}`}>{inr(outstanding)}</div></div>
          <span className={`p-2.5 rounded-lg ${outstanding ? 'bg-warn-bg text-warn' : 'bg-ok-bg text-ok'}`}><ShieldCheck size={20} /></span>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'subs', label: 'Subscriptions', count: subscriptions.length }, { value: 'inv', label: 'Invoices', count: invoices.length }, { value: 'pay', label: 'Payments', count: payments.length }]} />
      <div className="card">
        {tab === 'subs' && <SubscriptionTable rows={subscriptions} showCustomer={false} />}
        {tab === 'inv' && <InvoiceTable rows={invoices} showCustomer={false} onPay={setPaying} />}
        {tab === 'pay' && (payments.length ? (
          <table className="tbl"><thead><tr><th>Date</th><th>Method</th><th>Note</th><th className="r">Amount</th></tr></thead>
            <tbody>{payments.map((p) => <tr key={p.id}><td className="num">{fmtDate(p.paidOn)}</td><td>{p.method}</td><td className="text-muted">{p.note || '—'}</td><td className="r num">{inr(p.amount)}</td></tr>)}</tbody></table>
        ) : (
          <Empty title="No payments yet" />
        ))}
      </div>
      {editing && <CustomerModal open initial={c} onClose={() => setEditing(false)} />}
      {paying && <RecordPaymentModal invoice={paying} onClose={() => setPaying(null)} />}
    </>
  );
}
