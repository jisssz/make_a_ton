import { Link } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { PageHeader, Tabs, Pagination, Loading } from '../../components/ui';
import { SubscriptionTable, useUrlState } from '../../components/shared';
import { api } from '../../data/api';
import { useQuery } from '../../lib/hooks';

const STATES = [['', 'All'], ['ACTIVE', 'Active'], ['PAUSED', 'Paused'], ['QUOTATION', 'Quotation'], ['DRAFT', 'Draft'], ['CONFIRMED', 'Confirmed'], ['CLOSED', 'Closed']];

export default function Subscriptions() {
  const [st, set] = useUrlState({ q: '', state: '', planId: '', expiring: '' });
  const { data } = useQuery(() => api.subscriptions(st), [st.q, st.state, st.planId, st.expiring, st.page]);
  const { data: lk } = useQuery(() => api.lookups(), []);
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : null;
  return (
    <>
      <PageHeader title="Subscriptions" subtitle="Every customer contract, its plan, next bill date and status."
        actions={<Link to="/app/subscriptions/new" className="btn-primary"><Plus size={15} />New subscription</Link>} />
      <Tabs value={st.state} onChange={(state) => set({ state })} tabs={STATES.map(([v, l]) => ({ value: v, label: l, count: data ? (v ? data.counts[v] || 0 : total) : null }))} />
      <div className="card">
        <div className="p-3 border-b border-line flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Search SUB- number or customer" value={st.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search subscriptions" /></div>
          <select className="input w-auto" value={st.planId} onChange={(e) => set({ planId: e.target.value })} aria-label="Plan">
            <option value="">All plans</option>{lk?.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className={`btn-sm ${st.expiring ? 'btn-primary' : 'btn-secondary'}`} onClick={() => set({ expiring: st.expiring ? '' : '1' })}>Expiring in 30 days</button>
          {(st.q || st.planId || st.expiring) && <button className="btn-link" onClick={() => set({ q: '', planId: '', expiring: '' })}><X size={13} />Clear</button>}
        </div>
        {!data ? <div className="p-4"><Loading /></div> : <SubscriptionTable rows={data.rows} />}
      </div>
      {data && <Pagination page={data.page} size={data.size} total={data.total} onPage={(page) => set({ page })} />}
    </>
  );
}
