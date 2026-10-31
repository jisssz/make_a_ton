import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repeat, Receipt, Sparkles } from 'lucide-react';
import { PageHeader, Loading, Status, Empty, Kpi, Pagination, Tabs } from '../../components/ui';
import { InvoiceTable, useUrlState } from '../../components/shared';
import { UpiPaymentModal } from '../../components/UpiPaymentModal';
import { api } from '../../data/api';
import { useQuery, useAuth } from '../../lib/hooks';
import { inr, fmtDate } from '../../lib/format';
import { periodLabel } from '../../lib/dates';

export function PortalHome() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [upiInvoice, setUpiInvoice] = useState(null);
  const { data, refetch } = useQuery(async () => {
    const [subs, inv] = await Promise.all([api.subscriptions({}), api.invoices({ filter: 'unpaid' })]);
    return { subs: subs.rows, unpaid: inv.rows };
  }, []);
  if (!data) return <Loading rows={6} />;
  const active = data.subs.filter((s) => s.state === 'ACTIVE');
  const due = data.unpaid.reduce((a, i) => a + i.balance, 0);
  const next = active.map((s) => s.nextBillingDate).filter(Boolean).sort()[0];
  return (
    <>
      <PageHeader title={`Hello, ${user.name.split(' ')[0]}`} subtitle="Your subscriptions and invoices with Brightloop Software." />
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Kpi label="Active subscriptions" value={active.length} icon={Repeat} />
        <Kpi label="Balance due" value={inr(due)} hint={`${data.unpaid.length} unpaid invoice${data.unpaid.length === 1 ? '' : 's'}`} icon={Receipt} tone={due ? 'amber' : 'green'} to="/portal/invoices" />
        <Kpi label="Next invoice" value={next ? fmtDate(next) : '—'} icon={Repeat} tone="teal" />
      </div>
      <h2 className="micro mb-2">My subscriptions</h2>
      {data.subs.length === 0 ? <div className="card"><Empty icon={Repeat} title="No subscriptions yet" text="Contact Brightloop to get a quotation." /></div> : (
        <div className="grid md:grid-cols-2 gap-4">
          {data.subs.map((s) => (
            <button key={s.id} onClick={() => nav(`/portal/subscriptions/${s.id}`)} className="card p-4 text-left hover:shadow-l1 transition-shadow">
              <div className="flex items-start justify-between">
                <div><div className="font-semibold text-[16px]">{s.plan}</div><div className="text-[12px] text-muted">{s.number} · {s.qty} seat{s.qty > 1 ? 's' : ''} · {periodLabel[s.period]}</div></div>
                <Status value={s.state} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-[13px]">
                <div><div className="micro">Monthly</div><div className="num font-medium">{inr(s.mrr)}</div></div>
                <div><div className="micro">Next bill</div><div className="num">{s.state === 'ACTIVE' ? fmtDate(s.nextBillingDate) : '—'}</div></div>
                <div><div className="micro">Renews</div><div className="num">{fmtDate(s.expiryDate)}</div></div>
              </div>
            </button>
          ))}
        </div>
      )}
      {data.unpaid.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-8 mb-2">
            <h2 className="micro">Unpaid invoices</h2>
            <span className="text-[11px] text-ok font-medium flex items-center gap-1">
              <Sparkles size={12} /> Instant UPI payment enabled
            </span>
          </div>
          <div className="card">
            <InvoiceTable
              rows={data.unpaid}
              base="/portal/invoices"
              showCustomer={false}
              onPay={(inv) => setUpiInvoice(inv)}
              payLabel="⚡ Pay via UPI"
              payTone="teal"
            />
          </div>
        </>
      )}

      {upiInvoice && (
        <UpiPaymentModal
          open
          invoice={upiInvoice}
          customer={{ name: user.name }}
          onClose={() => setUpiInvoice(null)}
          onSettled={() => {
            if (refetch) refetch();
          }}
        />
      )}
    </>
  );
}

export function PortalInvoices() {
  const { user } = useAuth();
  const [st, set] = useUrlState({ filter: '' });
  const [upiInvoice, setUpiInvoice] = useState(null);
  const { data, refetch } = useQuery(() => api.invoices(st), [st.filter, st.page]);
  return (
    <>
      <PageHeader title="Invoices" subtitle="Download or print any invoice, or settle instantly with Bharat UPI." />
      <Tabs value={st.filter} onChange={(filter) => set({ filter })} tabs={[{ value: '', label: 'All' }, { value: 'unpaid', label: 'Unpaid' }, { value: 'overdue', label: 'Overdue' }, { value: 'PAID', label: 'Paid' }]} />
      <div className="card">
        {!data ? (
          <div className="p-4"><Loading /></div>
        ) : (
          <InvoiceTable
            rows={data.rows}
            base="/portal/invoices"
            showCustomer={false}
            onPay={(inv) => setUpiInvoice(inv)}
            payLabel="⚡ Pay via UPI"
            payTone="teal"
          />
        )}
      </div>
      {data && <Pagination page={data.page} size={data.size} total={data.total} onPage={(page) => set({ page })} />}

      {upiInvoice && (
        <UpiPaymentModal
          open
          invoice={upiInvoice}
          customer={{ name: user?.name }}
          onClose={() => setUpiInvoice(null)}
          onSettled={() => {
            if (refetch) refetch();
          }}
        />
      )}
    </>
  );
}
