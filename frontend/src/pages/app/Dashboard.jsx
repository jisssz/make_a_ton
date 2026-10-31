import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import {
  Repeat, TrendingUp, Wallet, Receipt, AlertTriangle, Zap, CalendarClock, FileText, Tag, ArrowRight, Timer, ShieldCheck,
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
              <li key={i.key} className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 text-[13px]">
                {i.count ? <AlertTriangle size={15} className="text-warn shrink-0" /> : <ShieldCheck size={15} className="text-ok shrink-0" />}
                <span className="flex-1">{i.label}</span>
                <span className={`num font-semibold ${i.count ? 'text-bad' : 'text-ok'}`}>{i.count}</span>
                {i.count > 0 && i.to && <Link to={i.to} className="text-plum" aria-label={i.fix}><ArrowRight size={15} /></Link>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card title="MRR trend" action={<span className="text-[12px] text-muted">Last 12 months</span>}>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={chart} margin={{ left: 8, right: 8, top: 8 }}>
                <defs><linearGradient id="mrr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#714B67" stopOpacity={0.25} /><stop offset="100%" stopColor="#714B67" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="#E8E8EC" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#747783' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={inrCompact} tick={{ fontSize: 11, fill: '#747783' }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="mrr" name="MRR" stroke="#714B67" strokeWidth={2} fill="url(#mrr)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Billed vs collected" action={<span className="text-[12px] text-muted">Invoiced value vs cash received</span>}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ left: 8, right: 8, top: 8 }} barGap={2}>
                <CartesianGrid stroke="#E8E8EC" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#747783' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={inrCompact} tick={{ fontSize: 11, fill: '#747783' }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<ChartTip />} cursor={{ fill: '#F7F7F8' }} />
                <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="billed" name="Billed" fill="#714B67" radius={[3, 3, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill="#008784" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Receivables aging" action={<Link to="/app/invoices?filter=overdue" className="btn-link">View overdue</Link>}>
          <div className="h-52">
            <ResponsiveContainer>
              <BarChart data={agingData} layout="vertical" margin={{ left: 0, right: 16 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#747783' }} axisLine={false} tickLine={false} width={64} />
                <Tooltip formatter={(v) => inr(v)} cursor={{ fill: '#F7F7F8' }} />
                <Bar dataKey="value" name="Outstanding" fill="#D69A35" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Overdue — oldest first" pad={false} action={<Link to="/app/invoices?filter=overdue" className="btn-link">All</Link>}>
          <table className="tbl">
            <tbody>
              {c.overdue.map((i) => (
                <tr key={i.id} className="cursor-pointer" onClick={() => nav(`/app/invoices/${i.id}`)}>
                  <td><div className="font-medium">{i.customer}</div><div className="text-[12px] text-muted">{i.number}</div></td>
                  <td className="r"><div className="num font-medium">{inr0(i.balance)}</div><div className="text-[12px] text-bad">{i.daysOverdue} days</div></td>
                </tr>
              ))}
              {!c.overdue.length && <tr><td className="text-muted text-center py-8">Nothing overdue 🎉</td></tr>}
            </tbody>
          </table>
        </Card>
        <Card title="Recent activity" pad={false}>
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
