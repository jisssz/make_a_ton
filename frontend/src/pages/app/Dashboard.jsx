import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';
import {
  TrendingUp, RefreshCw, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { Loading } from '../../components/ui';
import { api } from '../../data/api';
import { useQuery, useAction, useAuth } from '../../lib/hooks';
import { inr0, inrCompact, fmtDate, fmtDateTime, pct } from '../../lib/format';
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
  const [showAnalytics, setShowAnalytics] = useState(false);
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
  const firstName = user?.name ? user.name.split(' ')[0] : 'Ann';

  return (
    <div className="space-y-6">
      {/* Greeting and Filter Controls Bar */}
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
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              aria-label="Date range"
            >
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <div className="bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 flex items-center gap-2 shadow-2xs hover:bg-slate-50 pointer-events-none select-none">
              <span>{RANGES.find((r) => r.value === range)?.label || 'This month'}</span>
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Plans selector */}
          <div className="relative">
            <select
              className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              aria-label="Plan filter"
            >
              <option value="">All plans</option>
              {lk?.plans?.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <div className="bg-white border border-slate-200/90 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 flex items-center gap-2 shadow-2xs hover:bg-slate-50 pointer-events-none select-none">
              <span>{planId ? lk?.plans?.find((p) => p.id === planId)?.name : 'All plans'}</span>
              <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </div>
          </div>

          {/* Fast Load Time Status Pill */}
          <button
            type="button"
            onClick={reload}
            className="flex items-center gap-1.5 bg-[#eafaf0] text-[#1c7e42] border border-[#c6f0d4] rounded-xl px-2.5 py-1.5 text-xs font-medium hover:bg-[#d8f5e3] transition-colors cursor-pointer"
            title="Reload live metrics"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Loaded in {data?.ms || 1} ms</span>
            <svg
              className={`w-3.5 h-3.5 text-emerald-600 ${loading ? 'animate-spin' : 'hover:rotate-180 transition-transform'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* BEGIN: StatCardsRow */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5" data-purpose="metrics-row">
        {/* Metric Card 1: Active Subscriptions */}
        <Link
          to="/app/subscriptions?state=ACTIVE"
          className="bg-white rounded-2xl p-4 border border-card-border custom-shadow-card flex flex-col justify-between hover:border-purple-300 transition-all group"
        >
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
      {/* END: StatCardsRow */}

      {/* BEGIN: RevenueSuiteBanner */}
      <section className="bg-gradient-to-r from-[#ebd6f9]/60 via-[#f3e5fa]/40 to-[#ece0fc]/50 border border-purple-200/70 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4" data-purpose="intelligent-revenue-suite-banner">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6f236e] to-[#4c164a] text-white flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
            <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Open AI Copilot</span>
          </button>
          <Link
            to="/app/customers?healthFilter=at_risk"
            className="bg-white hover:bg-slate-50 border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-purple-900 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Churn Matrix</span>
          </Link>
          <Link
            to="/app/billing"
            className="bg-white hover:bg-slate-50 border border-purple-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-purple-900 flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Time Machine</span>
          </Link>
        </div>
      </section>
      {/* END: RevenueSuiteBanner */}

      {/* BEGIN: BottomSplitGrid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Billing Control Centre (Left Column, span 7) */}
        <section className="lg:col-span-7 bg-white rounded-2xl border border-card-border custom-shadow-card p-5" data-purpose="billing-control-centre">
          <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
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
                <svg className="w-3.5 h-3.5 text-slate-600 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <span>Run billing</span>
              </Link>
            </div>

            {/* Row 2: Draft invoices */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
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
                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{busy ? 'Confirming…' : 'Confirm all'}</span>
              </button>
            </div>

            {/* Row 3: Overdue invoices */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
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
                <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Chase</span>
              </Link>
            </div>

            {/* Row 4: Renewals due */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
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
                <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Review</span>
              </Link>
            </div>

            {/* Row 5: Quotations expiring */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
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
                <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Open</span>
              </Link>
            </div>

            {/* Row 6: Discounts ending */}
            <div className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="truncate">
                  <h4 className="text-xs font-bold text-slate-800">
                    {c.discounts.length} discount{c.discounts.length === 1 ? '' : 's'} ending soon or near limit
                  </h4>
                  <p className="text-[11px] text-slate-500 truncate">
                    {c.discounts.map((d) => d.name).join(', ') || 'Diwali Offer'}
                  </p>
                </div>
              </div>
              <Link
                to="/app/catalog?tab=discounts"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex-shrink-0 transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
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
      {/* END: BottomSplitGrid */}

      {/* Expandable Extended Analytics & Forecasting Section */}
      <div className="pt-2 border-t border-slate-200/60">
        <button
          type="button"
          onClick={() => setShowAnalytics((v) => !v)}
          className="w-full py-2 px-4 rounded-xl border border-purple-200/80 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-between shadow-2xs transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-600" />
            <span>Interactive 30-60-90 Day AI Revenue Forecasting &amp; Trend Analytics</span>
          </div>
          <div className="flex items-center gap-1.5 text-purple-700 font-bold">
            <span>{showAnalytics ? 'Hide Analytics' : 'Explore Charts'}</span>
            {showAnalytics ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {showAnalytics && (
          <div className="mt-5 space-y-6 animate-fadeIn">
            {/* 30-60-90 Day Predictive Revenue & Cash Forecasting */}
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

            {/* Charts: MRR & ARR trend + Aging Buckets */}
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

            {/* Subscriptions by Plan & Recent Activity */}
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
        )}
      </div>
    </div>
  );
}
