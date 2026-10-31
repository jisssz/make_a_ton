import { Link } from 'react-router-dom';
import { Search, CreditCard } from 'lucide-react';
import { PageHeader, Pagination, Loading, Empty, Badge } from '../../components/ui';
import { useUrlState } from '../../components/shared';
import { api } from '../../data/api';
import { useQuery } from '../../lib/hooks';
import { inr, fmtDate } from '../../lib/format';

const METHOD_TONE = { UPI: 'plum', BANK: 'teal', CARD: 'amber', CASH: 'gray' };

export default function Payments() {
  const [st, set] = useUrlState({ q: '', method: '', from: '', to: '' });
  const { data } = useQuery(() => api.payments(st), [st.q, st.method, st.from, st.to, st.page]);
  return (
    <>
      <PageHeader title="Payments" subtitle="Every payment recorded against an invoice. Record new ones from an unpaid invoice."
        actions={<Link to="/app/invoices?filter=unpaid" className="btn-primary"><CreditCard size={15} />Record a payment</Link>} />
      <div className="card">
        <div className="p-3 border-b border-line flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input pl-9" placeholder="Search invoice, customer or note" value={st.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search payments" /></div>
          <select className="input w-auto" value={st.method} onChange={(e) => set({ method: e.target.value })} aria-label="Method">
            <option value="">All methods</option><option value="UPI">UPI</option><option value="BANK">Bank transfer</option><option value="CARD">Card</option><option value="CASH">Cash</option>
          </select>
          <label className="flex items-center gap-1.5 text-[12px] text-muted">From <input type="date" className="input h-8 w-auto" value={st.from} onChange={(e) => set({ from: e.target.value })} /></label>
          <label className="flex items-center gap-1.5 text-[12px] text-muted">To <input type="date" className="input h-8 w-auto" value={st.to} onChange={(e) => set({ to: e.target.value })} /></label>
          {data && <div className="ml-auto text-[12px] text-muted">Total received <span className="num font-semibold text-ok">{inr(data.totalAmount)}</span></div>}
        </div>
        {!data ? <div className="p-4"><Loading /></div> : data.rows.length === 0 ? <Empty icon={CreditCard} title="No payments found" /> : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Note</th><th>Recorded by</th><th className="r">Amount</th></tr></thead>
              <tbody>
                {data.rows.map((p) => (
                  <tr key={p.id}>
                    <td className="num">{fmtDate(p.paidOn)}</td>
                    <td>{p.customer}</td>
                    <td><Link to={`/app/invoices/${p.invoiceId}`} className="text-plum font-medium hover:underline">{p.invoiceNumber}</Link></td>
                    <td><Badge tone={METHOD_TONE[p.method]}>{p.method === 'BANK' ? 'Bank' : p.method}</Badge></td>
                    <td className="text-muted">{p.note || '—'}</td>
                    <td className="text-muted">{p.recordedBy}</td>
                    <td className="r num font-medium">{inr(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && <Pagination page={data.page} size={data.size} total={data.total} onPage={(page) => set({ page })} />}
    </>
  );
}
