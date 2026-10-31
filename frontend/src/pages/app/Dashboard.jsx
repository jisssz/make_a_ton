import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import {
  Repeat, TrendingUp, Wallet, Receipt, AlertTriangle, Zap, CalendarClock, FileText, Tag, ArrowRight, Timer, ShieldCheck,
  Sparkles, Clock, Smartphone,
} from 'lucide-react';
import { PageHeader, Kpi, Card, Loading, Badge } from '../../components/ui';
import { api } from '../../data/api';
import { useQuery, useAction, useAuth } from '../../lib/hooks';
import { inr, inr0, inrCompact, fmtDate, fmtDateTime, pct } from '../../lib/format';
import { addDays, monthLabel, todayIST } from '../../lib/dates';

const RANGES = [
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'Last 3 months' },
  { value: 'year', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
];
const rangeDates = (r, today) => {
  if (r === 'month') return { from: `${today.slice(0, 7)}-01`, to: today };
  if (r === 'quarter') return { from: addDays(today, -90), to: today };
  if (r === 'year') return { from: addDays(today, -365), to: today };
  return {};
};

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-line rounded shadow-l1 px-3 py-2 text-[12px]">
      <div className="font-medium mb-1">{label}</div>
      {payload.map((p) => <div key={p.dataKey} className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />{p.name}: <span className="num font-medium">{inr0(p.value)}</span></div>)}
    </div>
  );
};

function QueueRow({ icon: Icon, tone, title, detail, action, to, onClick }) {
  const tones = { amber: 'bg-warn-bg text-warn', red: 'bg-bad-bg text-bad', plum: 'bg-plum-subtle text-plum', teal: 'bg-teal-soft text-teal' };
  const inner = (
    <>
      <span className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${tones[tone]}`}><Icon size={17} /></span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[13px]">{title}</div>
        <div className="text-[12px] text-muted truncate">{detail}</div>
      </div>
      <span className="btn-secondary btn-sm">{action}</span>
    </>
  );
  const cls = 'flex items-center gap-3 px-4 py-3 border-b border-line last:border-0 hover:bg-canvas transition-colors w-full text-left';
  return onClick ? <button onClick={onClick} className={cls}>{inner}</button> : <Link to={to} className={cls}>{inner}</Link>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [range, setRange] = useState('month');
  const [planId, setPlanId] = useState('');
  const today = todayIST();
  const filters = useMemo(() => ({ ...rangeDates(range, today), planId }), [range, planId, today]);
  const { data, loading } = useQuery(() => api.dashboard(filters), [filters]);
  const { data: lk } = useQuery(() => api.lookups(), []);
  const { exec, busy } = useAction();

  if (loading && !data) return <><PageHeader title="Overview" /><Loading rows={8} /></>;
  const { summary: s, trends, aging, leakage, control: c } = data;
  const chart = trends.map((t) => ({ ...t, label: monthLabel(t.key) }));
  const agingData = [
    { name: 'Not due', value: aging.current }, { name: '1–30', value: aging.d30 }, { name: '31–60', value: aging.d60 },
    { name: '61–90', value: aging.d90 }, { name: '90+', value: aging.d90p },
  ];
  const rangeLabel = RANGES.find((r) => r.value === range).label.toLowerCase();

  return (
    <>
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${user.name.split(' ')[0]}`}
        subtitle="Here is what needs attention in your subscription business today."
        actions={(
          <>
            <select className="input h-8 w-auto" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
              {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <select className="input h-8 w-auto" value={planId} onChange={(e) => setPlanId(e.target.value)} aria-label="Plan filter">
              <option value="">All plans</option>
              {lk?.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className="inline-flex items-center gap-1 text-[11px] text-ok bg-ok-bg rounded px-2 py-1 num" title="Time to compute this dashboard"><Timer size={12} />Loaded in {data.ms} ms</span>
          </>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Kpi label="Active subscriptions" value={s.activeSubs.toLocaleString('en-IN')} hint={`${s.pausedSubs} paused · ${s.totalSubs.toLocaleString('en-IN')} total`} icon={Repeat} to="/app/subscriptions?state=ACTIVE" />
        <Kpi label="MRR" value={inrCompact(s.mrr)} hint={`ARR ${inrCompact(s.arr)} · ARPU ${inr0(s.arpu)}`} icon={TrendingUp} tone="teal" />
        <Kpi label="Cash collected" value={inrCompact(s.collected)} hint={`${pct(s.collectionRate)} of billed, ${rangeLabel}`} icon={Wallet} tone="green" to="/app/payments" />
        <Kpi label="Outstanding" value={inrCompact(s.outstanding)} hint={`Billed ${inrCompact(s.billed)} ${rangeLabel}`} icon={Receipt} tone="amber" to="/app/invoices?filter=unpaid" />
        <Kpi label="Overdue" value={inrCompact(s.overdue)} hint={`${s.overdueCount} invoices past due`} icon={AlertTriangle} tone="red" to="/app/invoices?filter=overdue" />
      </div>

      {/* SubSync Intelligent Innovation Bar */}
      <div className="bg-gradient-to-r from-plum-subtle via-white to-teal-soft/40 border border-line rounded-xl p-3.5 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-plum text-white flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-gold animate-pulse" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-charcoal flex items-center gap-2">
              SubSync Intelligent Revenue Suite
              <span className="text-[10px] font-bold uppercase bg-plum text-white px-1.5 py-0.2 rounded">Odoo x Make-A-Ton</span>
            </div>
            <div className="text-[12px] text-muted">AI Churn Mitigation · Time-Travel Sandbox · Dynamic Bharat UPI QR</div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }))}
            className="btn-secondary btn-sm flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white text-plum border-plum/30 hover:border-plum"
            title="Open SubSync AI Revenue Intelligence Copilot"
          >
            <Sparkles size={13} className="text-plum" />
            <span>Open AI Copilot</span>
          </button>
          <Link
            to="/app/customers?healthFilter=at_risk"
            className="btn-secondary btn-sm flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white text-bad border-bad/30 hover:bg-bad-bg"
            title="Inspect customers at risk of churn"
          >
            <ShieldCheck size={13} className="text-bad" />
            <span>Churn Matrix</span>
          </Link>
          <Link
            to="/app/billing"
            className="btn-secondary btn-sm flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white text-charcoal hover:bg-canvas"
            title="Launch Billing Run & Time Travel"
          >
            <Clock size={13} className="text-gold" />
            <span>Time Machine</span>
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="Billing Control Centre" className="lg:col-span-2" pad={false}
          action={<span className="text-[12px] text-muted">Your next actions</span>}>
          <QueueRow icon={Zap} tone="plum" title={`${c.dueToday} subscriptions due for billing`} detail={c.dueToday ? `About ${inr0(c.dueValue)} per month in recurring value waiting to be invoiced` : 'Everything is billed up to today'} action="Run billing" to="/app/billing" />
          <QueueRow icon={FileText} tone="teal" title={`${c.drafts} draft invoices to confirm`} detail={c.drafts ? `${inr0(c.draftValue)} ready to send to customers` : 'No drafts waiting'} action={busy ? 'Confirming…' : 'Confirm all'}
            onClick={c.drafts ? () => exec(() => api.confirmAllDrafts(), (n) => `${n} invoices confirmed and numbered`) : () => nav('/app/invoices')} />
          <QueueRow icon={AlertTriangle} tone="red" title={`${c.overdueCount} overdue invoices`} detail={c.overdue[0] ? `Oldest: ${c.overdue[0].number} · ${c.overdue[0].customer} · ${c.overdue[0].daysOverdue} days late` : 'Nothing overdue'} action="Chase" to="/app/invoices?filter=overdue" />
          <QueueRow icon={CalendarClock} tone="amber" title={`${c.renewalsCount} renewals due in 30 days`} detail={c.renewals.map((r) => r.customer).slice(0, 3).join(', ') || 'No renewals coming up'} action="Review" to="/app/subscriptions?expiring=1" />
          <QueueRow icon={FileText} tone="plum" title={`${c.expiringQuotes.length} quotations expiring this week`} detail={c.expiringQuotes.map((q) => `${q.number} (${fmtDate(q.validUntil)})`).join(', ') || 'No quotations about to expire'} action="Open" to="/app/quotations" />
          {c.discounts.length > 0 && <QueueRow icon={Tag} tone="amber" title={`${c.discounts.length} discount${c.discounts.length > 1 ? 's' : ''} ending soon or near limit`} detail={c.discounts.map((d) => d.name).join(', ')} action="Manage" to="/app/catalog?tab=discounts" />}
        </Card>

        <Card title="Revenue leakage check" pad={false} action={<Badge tone={leakage.atRisk ? 'red' : 'green'}>{leakage.atRisk ? 'Action needed' : 'All clear'}</Badge>}>
          <div className="px-4 py-4 border-b border-line">
            <div className="micro">Revenue at risk</div>
            <div className="text-[26px] font-semibold text-bad num">{inr0(leakage.atRisk)}</div>
            <div className="text-[12px] text-muted">Missed billing + invoices more than 60 days overdue</div>
          </div>
          <ul>
            {leakage.items.map((i) => (
              <li key={i.id} className="px-4 py-2.5 border-b border-line last:border-0 flex items-center justify-between text-[13px]">
                <div><div className="font-medium">{i.title}</div><div className="text-[12px] text-muted">{i.detail}</div></div>
                <div className="num text-bad font-medium">{inr0(i.value)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

{/* 30-60-90 Day Predictive Revenue Forecasting */}
      {data.forecast && (
        <Card
          title="Predictive Revenue & Cash Forecasting"
          className="mb-4"
          action={
            <span className="text-[12px] text-muted">
              Historical Collection Efficiency:{' '}
              <strong className="text-ok font-semibold">
                {data.forecast.historical_collection_rate_pct}%
              </strong>
            </span>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['30_days', '60_days', '90_days'].map((key) => {
              const proj = data.forecast.projections?.[key];
              if (!proj) return null;
              return (
                <div key={key} className="bg-canvas border border-line rounded-lg p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-semibold text-muted uppercase tracking-wider">{proj.label}</span>
                      <TrendingUp size={15} className="text-teal" />
                    </div>
                    <div className="text-[11px] text-muted mb-3">
                      Contractual Expected Billings:
                      <div className="text-[18px] font-bold text-plum num">
                        {inr0(proj.expected_billings)}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted mb-3">
                      Projected Cash Collections:
                      <div className="text-[16px] font-bold text-ok num">
                        {inr0(proj.expected_cash_collection)}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-line pt-2 text-[11px] text-muted flex justify-between">
                    <span>{proj.upcoming_invoices_count} billing cycles</span>
                    {proj.at_risk_amount > 0 ? (
                      <span className="text-warn font-medium">{inr0(proj.at_risk_amount)} at risk</span>
                    ) : (
                      <span className="text-ok font-medium">0 expiring</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}


      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card title="MRR & ARR trend" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gMrr" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#714B67" stopOpacity={0.3} /><stop offset="95%" stopColor="#714B67" stopOpacity={0} /></linearGradient>
                  <linearGradient id="gCash" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00A09D" stopOpacity={0.25} /><stop offset="95%" stopColor="#00A09D" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEF1" vertical={false} />
                <XAxis dataKey="label" stroke="#878A99" fontSize={11} tickLine={false} />
                <YAxis stroke="#878A99" fontSize={11} tickLine={false} tickFormatter={(v) => inrCompact(v)} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke="#714B67" strokeWidth={2} fillOpacity={1} fill="url(#gMrr)" />
                <Area type="monotone" dataKey="collected" name="Cash collected" stroke="#00A09D" strokeWidth={2} fillOpacity={1} fill="url(#gCash)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Aging buckets (unpaid)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEF1" vertical={false} />
                <XAxis dataKey="name" stroke="#878A99" fontSize={11} tickLine={false} />
                <YAxis stroke="#878A99" fontSize={11} tickLine={false} tickFormatter={(v) => inrCompact(v)} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="value" name="Amount" fill="#00A09D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Subscriptions by plan">
          <div className="space-y-2.5">
            {data.planMix.map((p) => {
              const max = Math.max(...data.planMix.map((x) => x.count), 1);
              const pctVal = Math.round((p.count / max) * 100);
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="num text-muted">{p.count}</span>
                  </div>
                  <div className="h-2 bg-canvas rounded overflow-hidden">
                    <div className="h-full bg-plum rounded" style={{ width: `${pctVal}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="Recent activity" pad={false} className="lg:col-span-2">
          <ul>
            {data.activity.map((a) => (
              <li key={a.id} className="px-4 py-2.5 border-b border-line last:border-0">
                <div className="text-[13px]"><span className="font-medium">{a.action}</span>{a.detail && <span className="text-muted"> · {a.detail}</span>}</div>
                <div className="text-[11px] text-muted">{a.actor} · {fmtDateTime(a.at)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
