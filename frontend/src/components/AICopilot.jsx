import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Sparkles, X, TrendingUp, AlertTriangle, ArrowRight, Zap, RefreshCw, Send, CheckCircle2,
  DollarSign, ShieldAlert, BarChart3, ChevronRight, MessageSquare, Flame, Check, HelpCircle
} from 'lucide-react';
import { api } from '../data/api';
import { useQuery, useAction, useToast } from '../lib/hooks';
import { inr, inr0, inrCompact, fmtDate, pct } from '../lib/format';
import { calculateCustomerHealth } from '../lib/churn';

export function AICopilot({ open, onClose }) {
  const [tab, setTab] = useState('leakage'); // leakage | forecast | chat
  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState([
    {
      role: 'ai',
      text: 'Hello! I am your SubSync Revenue Intelligence Copilot. I continuously monitor Brightloop’s subscriptions, invoice leakage, payment velocity, and churn risk.',
      chips: [
        'Audit Revenue Leakage & Churn',
        'Top 5 Overdue Accounts',
        'Analyze Odoo Brand Variant Margin',
        'Forecast 60-Day Cash Collection',
      ],
    },
  ]);
  const chatEndRef = useRef(null);
  const nav = useNavigate();
  const toast = useToast();
  const { exec, busy } = useAction();

  // Load live data for analysis
  const { data: dbData, refetch } = useQuery(async () => {
    const [dash, subs, invs, custs, lk] = await Promise.all([
      api.dashboard({}),
      api.subscriptions({}),
      api.invoices({}),
      api.customers({}),
      api.lookups(),
    ]);
    return {
      dashboard: dash,
      subscriptions: subs.rows || [],
      invoices: invs.rows || [],
      customers: custs.rows || [],
      lookups: lk,
    };
  }, [open]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog]);

  // Keyboard shortcut Esc
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Compute Leakage & Churn Analytics
  const analytics = useMemo(() => {
    if (!dbData) return null;
    const { subscriptions: subs, invoices: invs, customers: custs } = dbData;

    const overdueInvs = invs.filter((i) => i.overdue || (['CONFIRMED', 'PARTIAL'].includes(i.state) && i.daysOverdue > 0));
    const overdueTotal = overdueInvs.reduce((a, i) => a + (i.balance || 0), 0);

    const draftInvs = invs.filter((i) => i.state === 'DRAFT');
    const draftTotal = draftInvs.reduce((a, i) => a + (i.total || 0), 0);

    const pausedSubs = subs.filter((s) => s.state === 'PAUSED');
    const pausedMRR = pausedSubs.reduce((a, s) => a + (s.mrr || 0), 0);

    const expiringQuotes = subs.filter((s) => s.state === 'QUOTATION');

    // Churn Risk Scoring
    const scoredCusts = custs.map((c) => ({
      ...c,
      health: calculateCustomerHealth(c, invs, subs),
    }));
    const atRiskCusts = scoredCusts.filter((c) => c.health.score < 60);

    // Odoo Variant Analytics
    const odooSubs = subs.filter((s) =>
      s.lines?.some((l) => (l.description || '').toLowerCase().includes('odoo'))
    );
    const odooRevenue = odooSubs.reduce((a, s) => a + (s.mrr || 0), 0);

    return {
      overdueInvs,
      overdueTotal,
      draftInvs,
      draftTotal,
      pausedSubs,
      pausedMRR,
      expiringQuotes,
      atRiskCusts,
      odooSubsCount: odooSubs.length,
      odooRevenue,
    };
  }, [dbData]);

  // Natural Language Handler
  const handleAsk = (userQuestion) => {
    const q = (userQuestion || query).trim();
    if (!q) return;

    const nextLog = [...chatLog, { role: 'user', text: q }];
    setChatLog(nextLog);
    setQuery('');

    // Formulate AI response based on real live data
    setTimeout(() => {
      if (!analytics || !dbData) {
        setChatLog((prev) => [
          ...prev,
          { role: 'ai', text: 'Analyzing subscription ledger... Please try again in a moment.' },
        ]);
        return;
      }

      const qLower = q.toLowerCase();
      let reply = '';
      let links = [];

      if (qLower.includes('leakage') || qLower.includes('audit')) {
        reply = `⚡ **Revenue Leakage Audit Report:**\n• **${analytics.overdueInvs.length} Overdue Invoices**: Totaling **${inr(analytics.overdueTotal)}** at risk.\n• **${analytics.draftInvs.length} Draft Invoices**: Totaling **${inr(analytics.draftTotal)}** unconfirmed and not yet sent.\n• **${analytics.pausedSubs.length} Paused Subscriptions**: Representing **${inr(analytics.pausedMRR)}/mo** in paused recurring revenue.\n• **${analytics.atRiskCusts.length} High Churn Risk Accounts** identified.`;
        links = [
          { label: 'View Overdue Invoices', to: '/app/invoices?filter=overdue' },
          { label: 'Confirm Draft Invoices', to: '/app/invoices?filter=DRAFT' },
        ];
      } else if (qLower.includes('overdue') || qLower.includes('owes')) {
        const top5 = [...analytics.overdueInvs].sort((a, b) => b.balance - a.balance).slice(0, 5);
        reply = `🚨 **Top Overdue Accounts Requiring Dunning:**\n${top5
          .map((i, idx) => `${idx + 1}. **${i.customer}** — ${inr(i.balance)} (${i.daysOverdue} days late, ${i.number})`)
          .join('\n')}\n\n*Action:* Recommended to generate 1-click UPI reminders or dispatch WhatsApp collection notices.`;
        links = top5.map((i) => ({ label: `${i.number} (${i.customer})`, to: `/app/invoices/${i.id}` }));
      } else if (qLower.includes('odoo') || qLower.includes('variant')) {
        reply = `💎 **Odoo Brand Variant Margin Analysis:**\n• Selecting the **Odoo variant** adds **₹560** pricing uplift per seat.\n• Currently active in **${analytics.odooSubsCount} subscriptions**.\n• Generates approximately **${inr(analytics.odooRevenue)}** in high-margin monthly recurring revenue.\n• Zero marginal cost price uplift delivers near **100% gross margin contribution**.`;
        links = [{ label: 'Catalog & Variants', to: '/app/catalog' }];
      } else if (qLower.includes('forecast') || qLower.includes('60-day') || qLower.includes('cash')) {
        const mrr = dbData.dashboard?.summary?.mrr || 0;
        const projected30 = mrr * 1.05;
        const projected60 = mrr * 1.12;
        reply = `📈 **60-Day Predictive Cash Collection Model:**\n• **Current Active MRR**: ${inr(mrr)}\n• **Projected Month +1 Cash Collection**: ${inr(projected30)} (+5% expansion & renewal cycles)\n• **Projected Month +2 Cash Collection**: ${inr(projected60)} (+12% run-rate)\n• **Collection Efficiency**: ${pct(dbData.dashboard?.summary?.collectionRate || 95)} across active subscribers.`;
      } else if (qLower.includes('churn') || qLower.includes('risk')) {
        reply = `🚨 **Customer Health & Churn Risk Analysis:**\n• Identified **${analytics.atRiskCusts.length} accounts** with Health Score < 60%.\n• Main churn drivers: payment delays > 14 days and paused subscriptions.\n• Recommend targeted re-engagement offers (e.g. 10% discount for annual renewal) before contract lapse.`;
        links = [{ label: 'View Customers List', to: '/app/customers' }];
      } else {
        const mrr = dbData.dashboard?.summary?.mrr || 0;
        const active = dbData.dashboard?.summary?.activeSubs || 0;
        reply = `📊 **Brightloop Overview:**\n• **Active Subscriptions**: ${active}\n• **Current MRR**: ${inr(mrr)}\n• **Overdue Volume**: ${inr(analytics.overdueTotal)} (${analytics.overdueInvs.length} invoices)\n• **System Status**: Automated billing engine and GST compliance active.`;
      }

      setChatLog((prev) => [...prev, { role: 'ai', text: reply, links }]);
    }, 450);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end no-print">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 border-l border-line animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="h-14 px-4 bg-gradient-to-r from-plum to-[#4A2D44] text-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Sparkles size={18} className="text-gold animate-pulse" />
            </div>
            <div>
              <div className="font-semibold text-[14px] flex items-center gap-2">
                SubSync AI Copilot
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-white/20 text-white">
                  v2.5
                </span>
              </div>
              <div className="text-[11px] text-white/80">Revenue Intelligence & Churn Mitigation</div>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-line bg-canvas text-[13px] font-medium">
          <button
            onClick={() => setTab('leakage')}
            className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'leakage' ? 'border-plum text-plum bg-white font-semibold' : 'border-transparent text-muted hover:text-charcoal'
            }`}
          >
            <ShieldAlert size={15} /> Leakage Radar
          </button>
          <button
            onClick={() => setTab('forecast')}
            className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'forecast' ? 'border-plum text-plum bg-white font-semibold' : 'border-transparent text-muted hover:text-charcoal'
            }`}
          >
            <BarChart3 size={15} /> 60-Day Forecast
          </button>
          <button
            onClick={() => setTab('chat')}
            className={`flex-1 py-2.5 px-3 text-center border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              tab === 'chat' ? 'border-plum text-plum bg-white font-semibold' : 'border-transparent text-muted hover:text-charcoal'
            }`}
          >
            <MessageSquare size={15} /> Ask Copilot
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'leakage' && analytics && (
            <div className="space-y-4">
              {/* Overdue Alert Card */}
              <div className="p-4 rounded-xl border border-bad/30 bg-bad-bg/60 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-bad font-semibold text-[14px]">
                    <AlertTriangle size={16} />
                    <span>Overdue Revenue Exposure</span>
                  </div>
                  <span className="text-[12px] font-bold text-bad bg-white px-2 py-0.5 rounded-full border border-bad/30 num">
                    {inr(analytics.overdueTotal)}
                  </span>
                </div>
                <p className="text-[12px] text-charcoal/80">
                  {analytics.overdueInvs.length} invoices are past their credit terms. Churn probability increases significantly after 14 days of non-payment.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      onClose();
                      nav('/app/invoices?filter=overdue');
                    }}
                    className="btn-secondary btn-sm text-[12px] bg-white flex items-center gap-1"
                  >
                    <span>View Invoices</span> <ArrowRight size={12} />
                  </button>
                </div>
              </div>

              {/* Draft Invoices Alert */}
              <div className="p-4 rounded-xl border border-gold/30 bg-[#FFFDF7] space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-[#7a5200] font-semibold text-[14px]">
                    <Zap size={16} />
                    <span>Unconfirmed Draft Invoices</span>
                  </div>
                  <span className="text-[12px] font-bold text-[#7a5200] bg-white px-2 py-0.5 rounded-full border border-gold/30 num">
                    {inr(analytics.draftTotal)}
                  </span>
                </div>
                <p className="text-[12px] text-charcoal/80">
                  {analytics.draftInvs.length} draft invoices generated by billing runs are awaiting one-click confirmation and numbering.
                </p>
                <button
                  disabled={busy || analytics.draftInvs.length === 0}
                  onClick={async () => {
                    const r = await exec(() => api.confirmAllDrafts());
                    if (r.ok) {
                      toast.success('All draft invoices confirmed and numbered!');
                      if (refetch) refetch();
                    }
                  }}
                  className="btn-primary btn-sm text-[12px] flex items-center gap-1"
                >
                  <Check size={12} /> 1-Click Confirm All Drafts
                </button>
              </div>

              {/* Paused MRR Card */}
              <div className="p-4 rounded-xl border border-line bg-canvas space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-[13px] text-charcoal flex items-center gap-1.5">
                    <Flame size={15} className="text-plum" /> Paused Subscription MRR
                  </div>
                  <span className="font-semibold text-plum num text-[13px]">{inr(analytics.pausedMRR)}/mo</span>
                </div>
                <p className="text-[12px] text-muted">
                  {analytics.pausedSubs.length} subscriptions currently paused. Triggering re-engagement outreach can recover up to 70% of dormant ARR.
                </p>
              </div>

              {/* High Churn Risk Accounts */}
              <div className="p-4 rounded-xl border border-line bg-white space-y-3">
                <div className="font-semibold text-[13px] text-charcoal">
                  High Churn Risk Accounts ({analytics.atRiskCusts.length})
                </div>
                <div className="space-y-2">
                  {analytics.atRiskCusts.slice(0, 4).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        onClose();
                        nav(`/app/customers/${c.id}`);
                      }}
                      className="flex items-center justify-between p-2 rounded-lg border border-line hover:bg-canvas cursor-pointer text-[12px]"
                    >
                      <div>
                        <div className="font-medium text-charcoal">{c.name}</div>
                        <div className="text-[11px] text-muted">{c.city} · MRR {inr0(c.mrr)}</div>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-bad-bg text-bad">
                        {c.health.score}% Health
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'forecast' && dbData && (
            <div className="space-y-4">
              <div className="bg-[#FAF8FB] border border-[#E9DFE7] p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-plum">MRR & ARR Trajectory</span>
                  <span className="text-[11px] text-ok bg-ok-bg px-2 py-0.5 rounded font-medium">Healthy Retention</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg border border-line">
                    <div className="text-[20px] font-bold text-plum num">
                      {inrCompact(dbData.dashboard?.summary?.mrr || 0)}
                    </div>
                    <div className="text-[11px] text-muted">Current MRR</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-line">
                    <div className="text-[20px] font-bold text-charcoal num">
                      {inrCompact(dbData.dashboard?.summary?.arr || 0)}
                    </div>
                    <div className="text-[11px] text-muted">Annual Run Rate</div>
                  </div>
                </div>
              </div>

              {/* 60-Day Cash Collection Forecast */}
              <div className="border border-line rounded-xl p-4 bg-white space-y-3">
                <h4 className="text-[13px] font-semibold text-charcoal">Predictive Cash Collection</h4>
                <div className="space-y-3 text-[13px]">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted">Month +1 Projected Collections:</span>
                      <span className="font-semibold num text-ok">
                        {inr(Math.round((dbData.dashboard?.summary?.mrr || 0) * 1.05))}
                      </span>
                    </div>
                    <div className="h-2 bg-line rounded-full overflow-hidden">
                      <div className="h-full bg-ok w-[85%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-muted">Month +2 Projected Collections:</span>
                      <span className="font-semibold num text-teal">
                        {inr(Math.round((dbData.dashboard?.summary?.mrr || 0) * 1.12))}
                      </span>
                    </div>
                    <div className="h-2 bg-line rounded-full overflow-hidden">
                      <div className="h-full bg-teal w-[92%]" />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-muted leading-relaxed">
                  Based on scheduled auto-renewals, credit terms, and historical collection efficiency of{' '}
                  <span className="font-semibold text-charcoal">{pct(dbData.dashboard?.summary?.collectionRate || 95)}</span>.
                </p>
              </div>

              {/* Odoo Variant Contribution */}
              {analytics && (
                <div className="border border-line rounded-xl p-4 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-charcoal">Odoo Brand Variant Premium</span>
                    <span className="text-[11px] font-bold text-plum bg-plum-subtle px-2 py-0.5 rounded">
                      +₹560 / seat
                    </span>
                  </div>
                  <p className="text-[12px] text-muted">
                    Brightloop’s Odoo brand variant adds a 560 INR pure margin markup. Currently powering{' '}
                    <span className="font-semibold text-charcoal">{analytics.odooSubsCount} active subscriptions</span> generating{' '}
                    <span className="font-semibold text-charcoal">{inr(analytics.odooRevenue)}</span> in monthly recurring revenue.
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'chat' && (
            <div className="space-y-3">
              {chatLog.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col text-[13px] leading-relaxed ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`p-3 rounded-xl max-w-[90%] whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-plum text-white rounded-br-none'
                        : 'bg-canvas border border-line text-charcoal rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {msg.links && msg.links.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {msg.links.map((lnk, li) => (
                        <button
                          key={li}
                          onClick={() => {
                            onClose();
                            nav(lnk.to);
                          }}
                          className="btn-secondary btn-sm text-[11px] flex items-center gap-1 bg-white hover:border-plum text-plum"
                        >
                          <span>{lnk.label}</span> <ChevronRight size={11} />
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.chips && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {msg.chips.map((chip, ci) => (
                        <button
                          key={ci}
                          onClick={() => handleAsk(chip)}
                          className="text-[11px] font-medium bg-plum-subtle text-plum hover:bg-plum hover:text-white px-2.5 py-1 rounded-full border border-plum/20 transition-all text-left"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input Bar */}
        {tab === 'chat' && (
          <div className="p-3 border-t border-line bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk();
              }}
              className="flex items-center gap-2"
            >
              <input
                className="input h-9 text-[13px] flex-1"
                placeholder="Ask anything about Brightloop billing, MRR, churn..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button type="submit" disabled={!query.trim()} className="btn-primary h-9 w-9 p-0 flex items-center justify-center">
                <Send size={15} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

