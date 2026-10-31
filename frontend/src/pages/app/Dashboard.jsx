import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import {
  Users, TrendingUp, Wallet, CreditCard, Receipt, AlertTriangle, Zap, FileText, Tag,
  Sparkles, Clock, ShieldCheck, Layers, TrendingDown, Play, Check, Bell, Calendar,
  Eye, ExternalLink, RefreshCw, Settings,
} from 'lucide-react';
import { Loading } from '../../components/ui';
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
    <div className="bg-white border border-card-border rounded-xl shadow-l1 px-3 py-2 text-xs">
      <div className="font-semibold text-slate-800 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-sm" style={{ background: p.color }} />
          <span className="text-slate-600">{p.name}:</span>
          <span className="num font-bold text-slate-900">{inr0(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [range, setRange] = useState('month');
  const [planId, setPlanId] = useState('');
  const today = todayIST();
  const filters = useMemo(() => ({ ...rangeDates(range, today), planId }), [range, planId, today]);
  const { data, loading, reload } = useQuery(() => api.dashboard(filters), [filters]);
  const { data: lk } = useQuery(() => api.lookups(), []);
  const { exec, busy } = useAction();

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-slate-200/60 rounded-xl animate-pulse" />
        <Loading rows={8} />
      </div>
    );
  }

  const { summary: s, trends, aging, leakage, control: c } = data;
  const chart = trends.map((t) => ({ ...t, label: monthLabel(t.key) }));
  const agingData = [
    { name: 'Not due', value: aging.current },
    { name: '1–30', value: aging.d30 },
    { name: '31–60', value: aging.d60 },
    { name: '61–90', value: aging.d90 },
    { name: '90+', value: aging.d90p },
  ];
  const rangeLabel = RANGES.find((r) => r.value === range)?.label.toLowerCase() || 'this month';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name ? user.name.split(' ')[0] : 'Admin';

  return (
    <div className="space-y-6">
      {/* 1. Greeting and Filter Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
            {greeting}, {firstName} <span className="text-2xl">👋</span>
          </h1>
          <p className="text-xs text-slate-500 font-normal mt-0.5">
            Here is what needs attention in your subscription business today.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Timeframe selector */}
          <div className="relative">
            <select
              className="bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-400/20 cursor-pointer"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              aria-label="Date range"
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          {/* Plans selector */}
          <div className="relative">
            <select
              className="bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-400/20 cursor-pointer"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              aria-label="Plan filter"
            >
              <option value="">All plans</option>
              {lk?.plans?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {/* Fast Load Time Status Pill */}
          <button
            onClick={reload}
            className="flex items-center gap-1.5 bg-[#eafaf0] text-[#1c7e42] border border-[#c6f0d4] rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-[#d8f5e3] transition-colors cursor-pointer"
            title="Click to refresh live dashboard metrics"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Loaded in {data?.ms || 1} ms</span>
            <RefreshCw size={13} className={`text-emerald-600 ${loading ? 'animate-spin' : 'hover:rotate-180 transition-transform'}`} />
          </button>
        </div>
      </div>

      {/* 2. StatCardsRow (5 Stat Cards Row) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5" data-purpose="metrics-row">
        {/* Metric Card 1: Active Subscriptions */}
        <Link
          to="/app/subscriptions?state=ACTIVE"
          className="bg-white rounded-2xl p-4 border border-card-border custom-shadow-card flex flex-col justify-between hover:border-purple-300 transition-all group"
        >
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <Users size={14} />
              </div>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">ACTIVE SUBSCRIPTIONS</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {s.activeSubs.toLocaleString('en-IN')}
              </span>
              <svg className="w-14 h-5 stroke-purple-500 fill-none group-hover:scale-105 transition-transform" strokeWidth="2" viewBox="0 0 60 20">
                <path d="M2 14c8-3 14 2 22-2s12-8 20-3 10-1 14-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-3 border-t border-slate-50 pt-2">
            {s.pausedSubs} paused · {s.totalSubs.toLocaleString('en-IN')} total
          </p>
        </Link>

        {/* Metric Card 2: MRR */}
        <div className="bg-white rounded-2xl p-4 border border-card-border custom-shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp size={14} />
              </div>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">MRR</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {inrCompact(s.mrr)}
              </span>
              <svg className="w-14 h-5 stroke-emerald-500 fill-none" strokeWidth="2" viewBox="0 0 60 20">
                <path d="M2 17c10-2 16-10 24-9s14-6 20-7 8 2 12-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-3 border-t border-slate-50 pt-2">
            ARR {inrCompact(s.arr)} · ARPU {inr0(s.arpu)}
          </p>
        </div>

        {/* Metric Card 3: Cash Collected */}
        <Link
          to="/app/payments"
          className="bg-white rounded-2xl p-4 border border-card-border custom-shadow-card flex flex-col justify-between hover:border-sky-300 transition-all group"
        >
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <Wallet size={14} />
              </div>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">CASH COLLECTED</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {inrCompact(s.collected)}
              </span>
              <svg className="w-14 h-5 stroke-sky-500 fill-none group-hover:scale-105 transition-transform" strokeWidth="2" viewBox="0 0 60 20">
                <path d="M2 16c8 2 14-4 22-5s12 1 20-3 8-7 14-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-3 border-t border-slate-50 pt-2">
            {pct(s.collectionRate)} of billed, {rangeLabel}
          </p>
        </Link>

        {/* Metric Card 4: Outstanding */}
        <Link
          to="/app/invoices?filter=unpaid"
          className="bg-white rounded-2xl p-4 border border-card-border custom-shadow-card flex flex-col justify-between hover:border-amber-300 transition-all group"
        >
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Receipt size={14} />
              </div>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">OUTSTANDING</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {inrCompact(s.outstanding)}
              </span>
              <svg className="w-14 h-5 stroke-amber-500 fill-none group-hover:scale-105 transition-transform" strokeWidth="2" viewBox="0 0 60 20">
                <path d="M2 14c8 3 14-6 22-3s12 5 20 2 8-5 14-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-3 border-t border-slate-50 pt-2">
            Billed {inrCompact(s.billed)} {rangeLabel}
          </p>
        </Link>

        {/* Metric Card 5: Overdue */}
        <Link
          to="/app/invoices?filter=overdue"
          className="bg-white rounded-2xl p-4 border border-card-border custom-shadow-card flex flex-col justify-between hover:border-rose-300 transition-all group"
        >
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle size={14} />
              </div>
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">OVERDUE</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {inrCompact(s.overdue)}
              </span>
              <svg className="w-14 h-5 stroke-rose-500 fill-none group-hover:scale-105 transition-transform" strokeWidth="2" viewBox="0 0 60 20">
                <path d="M2 12c7-2 13 4 20 2s14-6 22-3 8 2 14-1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-medium mt-3 border-t border-slate-50 pt-2">
            {s.overdueCount} invoices past due
          </p>
        </Link>
      </section>

      {/* 3. SubSync Intelligent Revenue Suite Banner */}
      <section className="bg-gradient-to-r from-[#ebd6f9]/60 via-[#f3e5fa]/40 to-[#ece0fc]/50 border border-purple-200/70 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4" data-purpose="intelligent-revenue-suite-banner">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6f236e] to-[#4c164a] text-white flex items-center justify-center shadow-sm">
            <Sparkles size={20} className="text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">SubSync Intelligent Revenue Suite</h3>
              <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-[#581c5d] text-white tracking-wide">
                ODOO × MAKE-A-TON
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              AI Churn Mitigation · Time-Travel Sandbox · Dynamic Bharat UPI QR
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true }))}
            className="bg-white hover:bg-slate-50 border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-purple-900 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Zap size={14} className="text-purple-600" />
            <span>Open AI Copilot</span>
          </button>
          <Link
            to="/app/customers?healthFilter=at_risk"
            className="bg-white hover:bg-slate-50 border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-purple-900 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <ShieldCheck size={14} className="text-purple-600" />
            <span>Churn Matrix</span>
          </Link>
          <Link
            to="/app/billing"
            className="bg-white hover:bg-slate-50 border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-purple-900 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Clock size={14} className="text-purple-600" />
            <span>Time Machine</span>
          </Link>
        </div>
      </section>

      {/* 4. BottomSplitGrid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Billing Control Centre (Left Column, span 7) */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-card-border custom-shadow-card p-5" data-purpose="billing-control-centre">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center">
                <FileText size={15} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Billing Control Centre</h2>
            </div>
            <span className="text-xs font-medium text-slate-400">Your next actions</span>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Row 1: Subscriptions due for billing */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <Zap size={16} />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-slate-800">
                    {c.dueToday} subscriptions due for billing
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate">
                    {c.dueToday
                      ? `About ${inr0(c.dueValue)} per month in recurring value waiting to be invoiced`
                      : 'Everything is billed up to today'}
                  </p>
                </div>
              </div>
              <Link
                to="/app/billing"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex-shrink-0 transition-colors"
              >
                <Play size={12} className="text-slate-600 fill-current" />
                <span>Run billing</span>
              </Link>
            </div>

            {/* Row 2: Draft invoices */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-slate-800">
                    {c.drafts} draft invoices to confirm
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate">
                    {c.drafts ? `${inr0(c.draftValue)} ready to send to customers` : 'No drafts waiting'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={
                  c.drafts
                    ? () => exec(() => api.confirmAllDrafts(), (n) => `${n} invoices confirmed and numbered`)
                    : () => nav('/app/invoices')
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex-shrink-0 transition-colors cursor-pointer"
              >
                <Check size={14} className="text-emerald-600 stroke-[2.5]" />
                <span>{busy ? 'Confirming…' : 'Confirm all'}</span>
              </button>
            </div>

            {/* Row 3: Overdue invoices */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={16} />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-slate-800">
                    {c.overdueCount} overdue invoices
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {c.overdue[0]
                      ? `Oldest: ${c.overdue[0].number} · ${c.overdue[0].customer} · ${c.overdue[0].daysOverdue} days late`
                      : 'Nothing overdue'}
                  </p>
                </div>
              </div>
              <Link
                to="/app/invoices?filter=overdue"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex-shrink-0 transition-colors"
              >
                <Bell size={13} className="text-purple-600" />
                <span>Chase</span>
              </Link>
            </div>

            {/* Row 4: Renewals due */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Calendar size={16} />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-slate-800">
                    {c.renewalsCount} renewals due in 30 days
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {c.renewals.map((r) => r.customer).slice(0, 3).join(', ') || 'No renewals coming up'}
                  </p>
                </div>
              </div>
              <Link
                to="/app/subscriptions?expiring=1"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex-shrink-0 transition-colors"
              >
                <Eye size={13} className="text-purple-600" />
                <span>Review</span>
              </Link>
            </div>

            {/* Row 5: Quotations expiring */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <FileText size={16} />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-slate-800">
                    {c.expiringQuotes.length} quotations expiring this week
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {c.expiringQuotes.map((q) => `${q.number} (${fmtDate(q.validUntil)})`).join(', ') || 'No quotations about to expire'}
                  </p>
                </div>
              </div>
              <Link
                to="/app/quotations"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex-shrink-0 transition-colors"
              >
                <ExternalLink size={13} className="text-purple-600" />
                <span>Open</span>
              </Link>
            </div>

            {/* Row 6: Discounts ending */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center flex-shrink-0">
                  <Tag size={16} />
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-slate-800">
                    {c.discounts.length} discount{c.discounts.length === 1 ? '' : 's'} ending soon or near limit
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {c.discounts.map((d) => d.name).join(', ') || 'All discounts active and within limits'}
                  </p>
                </div>
              </div>
              <Link
                to="/app/catalog?tab=discounts"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex-shrink-0 transition-colors"
              >
                <Settings size={13} className="text-purple-600" />
                <span>Manage</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Revenue Leakage Check (Right Column, span 5) */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-card-border custom-shadow-card p-5" data-purpose="revenue-leakage-check">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center">
                <Layers size={15} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Revenue leakage check</h2>
            </div>
            {leakage.atRisk > 0 ? (
              <span className="px-2 py-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200/80 rounded-lg">
                ACTION NEEDED
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200/80 rounded-lg">
                ALL CLEAR
              </span>
            )}
          </div>

          {/* Highlight Box: Revenue at Risk */}
          <div className="mt-3.5 p-3.5 rounded-xl bg-gradient-to-r from-rose-50/70 to-pink-50/40 border border-rose-100/90 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">
                REVENUE AT RISK
              </span>
              <div className="text-2xl font-black text-rose-600 tracking-tight mt-0.5">
                {inr0(leakage.atRisk)}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Missed billing + invoices more than 60 days overdue
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100/70 text-rose-600 flex items-center justify-center flex-shrink-0">
              <TrendingDown size={20} />
            </div>
          </div>

          {/* Leakage Checklist Breakdown */}
          <div className="mt-3 divide-y divide-slate-100 text-xs">
            {leakage.items?.map((item, idx) => (
              <div key={item.key || item.id || idx} className="py-2.5 flex items-center justify-between">
                <div>
                  <h5 className="font-semibold text-slate-800 text-[11px]">{item.title || item.label}</h5>
                  {item.to ? (
                    <Link to={item.to} className="text-[10px] text-purple-600 hover:underline">
                      {item.detail || item.fix}
                    </Link>
                  ) : (
                    <p className="text-[10px] text-slate-400">{item.detail || item.fix}</p>
                  )}
                </div>
                <span className={`font-bold text-xs ${item.value > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {inr0(item.value)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 5. 30-60-90 Day Predictive Revenue & Cash Forecasting */}
      {data.forecast && (
        <section className="bg-white rounded-2xl border border-card-border custom-shadow-card p-5" data-purpose="predictive-revenue-forecasting">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-teal-soft text-teal flex items-center justify-center">
                <TrendingUp size={15} />
              </div>
              <h2 className="text-base font-bold text-slate-900">Predictive Revenue &amp; Cash Forecasting</h2>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Historical Collection Efficiency:{' '}
              <strong className="text-emerald-600 font-bold">
                {data.forecast.historical_collection_rate_pct}%
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['30_days', '60_days', '90_days'].map((key) => {
              const proj = data.forecast.projections?.[key];
              if (!proj) return null;
              return (
                <div key={key} className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{proj.label}</span>
                      <TrendingUp size={15} className="text-teal" />
                    </div>
                    <div className="text-[11px] text-slate-500 mb-3">
                      Contractual Expected Billings:
                      <div className="text-lg font-extrabold text-[#714B67] num">
                        {inr0(proj.expected_billings)}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-500 mb-3">
                      Projected Cash Collections:
                      <div className="text-base font-bold text-emerald-600 num">
                        {inr0(proj.expected_cash_collection)}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-200/70 pt-2 text-[11px] text-slate-500 flex justify-between">
                    <span>{proj.upcoming_invoices_count} billing cycles</span>
                    {proj.at_risk_amount > 0 ? (
                      <span className="text-amber-600 font-semibold">{inr0(proj.at_risk_amount)} at risk</span>
                    ) : (
                      <span className="text-emerald-600 font-semibold">0 expiring</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Charts: MRR & ARR trend + Aging Buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-8 bg-white rounded-2xl border border-card-border custom-shadow-card p-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-900">MRR &amp; ARR trend</h3>
            <span className="text-xs text-slate-400">12-Month Trajectory</span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gMrr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#714B67" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#714B67" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00A09D" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#00A09D" stopOpacity={0} />
                  </linearGradient>
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
        </section>

        <section className="lg:col-span-4 bg-white rounded-2xl border border-card-border custom-shadow-card p-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-900">Aging buckets (unpaid)</h3>
            <span className="text-xs text-slate-400">Overdue breakdown</span>
          </div>
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
        </section>
      </div>

      {/* 7. Subscriptions by Plan & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-4 bg-white rounded-2xl border border-card-border custom-shadow-card p-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-900">Subscriptions by plan</h3>
            <span className="text-xs text-slate-400">Distribution</span>
          </div>
          <div className="space-y-3">
            {data.planMix?.map((p) => {
              const max = Math.max(...data.planMix.map((x) => x.count), 1);
              const pctVal = Math.round((p.count / max) * 100);
              return (
                <div key={p.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-700 truncate">{p.name}</span>
                    <span className="num font-bold text-slate-500">{p.count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-700 rounded-full" style={{ width: `${pctVal}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-8 bg-white rounded-2xl border border-card-border custom-shadow-card p-5">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 mb-2">
            <h3 className="text-sm font-bold text-slate-900">Recent activity</h3>
            <span className="text-xs text-slate-400">Audit trail</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {data.activity?.map((a) => (
              <li key={a.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-800">
                    <span className="font-semibold">{a.action}</span>
                    {a.detail && <span className="text-slate-500"> · {a.detail}</span>}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {a.actor} · {fmtDateTime(a.at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
