import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, ShieldCheck, Calendar, RotateCcw, Check, Repeat, Receipt, Timer } from 'lucide-react';
import { PageHeader, Card, Loading, Empty } from '../../components/ui';
import { api, isDemoMode } from '../../data/api';
import { useQuery, useAction } from '../../lib/hooks';
import { fmtDate, fmtDateTime } from '../../lib/format';
import { addMonthsAnchored, todayIST } from '../../lib/dates';

const RULES = [
  [ShieldCheck, 'Never twice', 'Each subscription can have only one invoice per billing period. Running again creates nothing new.'],
  [RotateCcw, 'Never skipped', 'If billing was missed, every overdue period is caught up in date order.'],
  [Calendar, 'Month-end safe', 'A plan starting on the 31st bills on Feb 28/29, then Mar 31 — no drift.'],
  [Receipt, 'Correct totals', 'Plan + products → best discount → GST (CGST/SGST or IGST) → total, snapshot on the invoice.'],
];

export default function BillingRun() {
  const { data } = useQuery(() => api.billingRuns(), []);
  const { exec, busy } = useAction();
  const [last, setLast] = useState(null);
  const [simDate, setSimDate] = useState('');
  if (!data) return <Loading rows={8} />;
  const today = todayIST();

  const run = async () => {
    const r = await exec(() => api.runBilling(), (x) => (x.created ? `${x.created} invoices created` : 'Nothing new to bill — no duplicates created'));
    if (r.ok) setLast(r.result);
  };
  const simulate = async (iso) => { await api.setClock(iso && iso !== today ? iso : null); setLast(null); };

  return (
    <>
      <PageHeader title="Billing Run" subtitle="Creates invoices for every active subscription that is due. Safe to run any number of times." />
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 card p-6 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-plum-subtle" aria-hidden />
          <div className="relative">
            <div className="micro">Billing date</div>
            <div className="text-[28px] font-semibold tracking-tight num">{fmtDate(data.today)}</div>
            <div className="mt-4 flex flex-wrap gap-6">
              <div><div className="text-[32px] font-semibold num text-plum">{data.dueNow}</div><div className="text-[13px] text-muted">subscriptions due now</div></div>
              <div><div className="text-[32px] font-semibold num text-teal">{data.drafts}</div><div className="text-[13px] text-muted">draft invoices waiting</div></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button className="btn-primary h-11 px-6 text-[14px]" onClick={run} disabled={busy}><Zap size={17} />{busy ? 'Running…' : 'Run billing now'}</button>
              {data.drafts > 0 && <button className="btn-teal h-11 px-5" disabled={busy} onClick={() => exec(() => api.confirmAllDrafts(), (n) => `${n} invoices confirmed and numbered`)}><Check size={16} />Confirm {data.drafts} drafts</button>}
              <Link to="/app/invoices?filter=DRAFT" className="btn-secondary h-11">Review drafts</Link>
            </div>
          </div>
        </div>
        {isDemoMode ? (
          <Card title="Simulate a billing day">
            <p className="text-[13px] text-muted mb-3">Demo tool: jump ahead to see catch-up billing — e.g. 3 months later creates exactly 3 invoices per monthly subscription.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {[1, 3].map((m) => (
                <button key={m} className="btn-secondary btn-sm" onClick={() => simulate(addMonthsAnchored(today, m, Number(today.slice(8))))}>+{m} month{m > 1 ? 's' : ''}</button>
              ))}
              {data.clock && <button className="btn-link" onClick={() => simulate(null)}>Back to today</button>}
            </div>
            <div className="flex gap-2">
              <input type="date" className="input" value={simDate} min={today} onChange={(e) => setSimDate(e.target.value)} aria-label="Simulated billing date" />
              <button className="btn-secondary" disabled={!simDate} onClick={() => simulate(simDate)}>Set</button>
            </div>
          </Card>
        ) : (
          <Card title="Schedule"><p className="text-[13px] text-muted">The server runs this automatically every day at 06:00 IST. Use the button for an immediate run.</p></Card>
        )}
      </div>

      {last && (
        <div className={`card p-5 mb-4 border-l-4 ${last.created ? 'border-l-ok' : 'border-l-teal'}`}>
          <div className="font-semibold text-[15px] mb-3">{last.created ? 'Billing run complete' : 'Nothing new to bill'}</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><div className="micro">Invoices created</div><div className="text-[24px] font-semibold num text-ok">{last.created}</div></div>
            <div><div className="micro">Subscriptions billed</div><div className="text-[24px] font-semibold num">{last.subsBilled}</div></div>
            <div><div className="micro">Duplicates blocked</div><div className="text-[24px] font-semibold num">{last.skipped}</div></div>
            <div><div className="micro">Auto-closed</div><div className="text-[24px] font-semibold num">{last.closed}</div></div>
          </div>
          <div className="text-[12px] text-muted mt-3 flex items-center gap-1.5"><Timer size={13} />Finished in {last.durationMs} ms. {last.created ? 'Click “Run billing now” again — it will create 0 invoices.' : 'Every due period already has exactly one invoice.'}</div>
        </div>
      )}

      <div className="grid lg:grid-cols-4 gap-3 mb-4">
        {RULES.map(([I, t, d]) => (
          <div key={t} className="card p-4">
            <span className="w-8 h-8 rounded-md bg-plum-subtle text-plum flex items-center justify-center mb-2"><I size={16} /></span>
            <div className="font-semibold text-[14px]">{t}</div>
            <div className="text-[12px] text-muted mt-0.5">{d}</div>
          </div>
        ))}
      </div>

      <Card title="Run history" pad={false}>
        {data.runs.length === 0 ? <Empty icon={Repeat} title="No runs yet" text="Run billing to create this period’s invoices." /> : (
          <table className="tbl">
            <thead><tr><th>Ran at</th><th>Billing date</th><th>By</th><th className="r">Created</th><th className="r">Duplicates blocked</th><th className="r">Auto-closed</th><th className="r">Time</th></tr></thead>
            <tbody>{data.runs.map((r) => (
              <tr key={r.id}>
                <td className="num">{fmtDateTime(r.at)}</td><td className="num">{fmtDate(r.runDate)}</td><td>{r.by}</td>
                <td className="r num font-medium">{r.created}</td><td className="r num">{r.skipped}</td><td className="r num">{r.closed}</td><td className="r num text-muted">{r.durationMs} ms</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </>
  );
}
