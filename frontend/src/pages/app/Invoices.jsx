import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Zap, Check } from 'lucide-react';
import { PageHeader, Tabs, Pagination, Loading } from '../../components/ui';
import { InvoiceTable, RecordPaymentModal, useUrlState } from '../../components/shared';
import { api } from '../../data/api';
import { useQuery, useAction } from '../../lib/hooks';
import { inr } from '../../lib/format';

const FILTERS = [['', 'All'], ['DRAFT', 'Draft'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['PARTIAL', 'Partially paid'], ['PAID', 'Paid'], ['CANCELLED', 'Cancelled']];

export default function Invoices() {
  const [st, set] = useUrlState({ q: '', filter: '', from: '', to: '' });
  const [selected, setSelected] = useState(new Set());
  const [paying, setPaying] = useState(null);
  const { exec, busy } = useAction();
  const { data } = useQuery(() => api.invoices(st), [st.q, st.filter, st.from, st.to, st.page]);
  const confirmSel = async () => {
    const r = await exec(() => api.confirmInvoices([...selected]), (n) => `${n} invoice${n === 1 ? '' : 's'} confirmed and numbered`);
    if (r.ok) setSelected(new Set());
  };
  return (
    <>
      <PageHeader title="Invoices" subtitle="Created automatically from subscriptions on billing day. Draft → Confirmed → Paid."
        actions={<>
          {selected.size > 0 && <button className="btn-teal" onClick={confirmSel} disabled={busy}><Check size={15} />Confirm {selected.size} selected</button>}
          <Link to="/app/billing" className="btn-primary"><Zap size={15} />Run billing</Link>
        </>} />
      <Tabs value={st.filter} onChange={(filter) => { set({ filter }); setSelected(new Set()); }} tabs={FILTERS.map(([v, l]) => ({ value: v, label: l }))} />
      <div className="card">
        <div className="p-3 border-b border-line flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Search INV/ number or customer" value={st.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search invoices" /></div>
          <label className="flex items-center gap-1.5 text-[12px] text-muted">From <input type="date" className="input h-8 w-auto" value={st.from} onChange={(e) => set({ from: e.target.value })} /></label>
          <label className="flex items-center gap-1.5 text-[12px] text-muted">To <input type="date" className="input h-8 w-auto" value={st.to} onChange={(e) => set({ to: e.target.value })} /></label>
          {data && <div className="ml-auto text-[12px] text-muted">Total <span className="num font-semibold text-charcoal">{inr(data.totals.total)}</span> · Balance due <span className="num font-semibold text-warn">{inr(data.totals.balance)}</span></div>}
        </div>
        {!data ? <div className="p-4"><Loading /></div> : (
          <InvoiceTable rows={data.rows} selectable selected={selected} onSelect={(ids) => setSelected(new Set(ids))} onPay={setPaying} />
        )}
      </div>
      {data && <Pagination page={data.page} size={data.size} total={data.total} onPage={(page) => set({ page })} />}
      {paying && <RecordPaymentModal invoice={paying} onClose={() => setPaying(null)} />}
    </>
  );
}
