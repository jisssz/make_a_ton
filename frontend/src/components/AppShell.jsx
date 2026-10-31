import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Repeat, FileText, Receipt, CreditCard, Package, UserPlus, Settings, Search,
  LogOut, Menu, Zap, Calendar, Sparkles, Clock, Crown, Building2, ChevronDown, Bell
} from 'lucide-react';
import { Badge } from './ui';
import { useAuth } from '../lib/hooks';
import { api, isDemoMode } from '../data/api';
import { fmtDate, initials } from '../lib/format';
import { useQuery } from '../lib/hooks';
import { AICopilot } from './AICopilot';
import { TimeTravelModal } from './TimeTravelModal';

const NAV = [
  { group: 'Operations', items: [
    { to: '/app', end: true, label: 'Overview', icon: LayoutDashboard },
    { to: '/app/customers', label: 'Customers', icon: Users },
    { to: '/app/quotations', label: 'Quotations', icon: FileText },
    { to: '/app/subscriptions', label: 'Subscriptions', icon: Repeat },
  ] },
  { group: 'Billing', items: [
    { to: '/app/billing', label: 'Billing Run', icon: Zap },
    { to: '/app/invoices', label: 'Invoices', icon: Receipt },
    { to: '/app/payments', label: 'Payments', icon: CreditCard },
  ] },
  { group: 'Configuration', items: [
    { to: '/app/catalog', label: 'Products & Plans', icon: Package },
    { to: '/app/users', label: 'Users', icon: UserPlus, admin: true },
    { to: '/app/settings', label: 'Settings', icon: Settings, admin: true },
  ] },
];

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef(null);
  const { data } = useQuery(async () => {
    if (q.trim().length < 2) return null;
    const [subs, invs, custs] = await Promise.all([api.subscriptions({ q }), api.invoices({ q }), api.customers({ q })]);
    return { subs: subs.rows.slice(0, 4), invs: invs.rows.slice(0, 4), custs: custs.rows.slice(0, 4) };
  }, [q]);
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); ref.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const go = (to) => { setOpen(false); setQ(''); nav(to); };
  const has = data && (data.subs.length || data.invs.length || data.custs.length);
  return (
    <div className="relative w-full max-w-sm">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
        <Search size={14} />
      </div>
      <input
        ref={ref}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full pl-9 pr-14 py-1.5 text-xs bg-slate-50 border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/20 focus:border-purple-400 text-slate-700 placeholder-slate-400 transition-all"
        placeholder="Search customers, SUB-, INV-..."
        aria-label="Global search"
      />
      <div className="absolute inset-y-0 right-1.5 flex items-center">
        <kbd className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 border border-slate-300/80 rounded px-1.5 py-0.5 shadow-2xs">Ctrl K</kbd>
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute top-10 left-0 right-0 bg-white border border-line rounded-xl shadow-l2 py-2 z-40 max-h-96 overflow-y-auto">
          {!has && <div className="px-4 py-3 text-muted text-[13px]">No matches for “{q}”</div>}
          {data?.custs.length > 0 && <div className="px-4 pt-1 pb-1 micro">Customers</div>}
          {data?.custs.map((c) => <button key={`c${c.id}`} onMouseDown={() => go(`/app/customers/${c.id}`)} className="w-full text-left px-4 py-1.5 hover:bg-canvas text-[13px]">{c.name}<span className="text-muted"> · {c.city}</span></button>)}
          {data?.subs.length > 0 && <div className="px-4 pt-2 pb-1 micro">Subscriptions</div>}
          {data?.subs.map((s) => <button key={`s${s.id}`} onMouseDown={() => go(`/app/subscriptions/${s.id}`)} className="w-full text-left px-4 py-1.5 hover:bg-canvas text-[13px]"><span className="font-medium">{s.number}</span><span className="text-muted"> · {s.customer}</span></button>)}
          {data?.invs.length > 0 && <div className="px-4 pt-2 pb-1 micro">Invoices</div>}
          {data?.invs.map((i) => <button key={`i${i.id}`} onMouseDown={() => go(`/app/invoices/${i.id}`)} className="w-full text-left px-4 py-1.5 hover:bg-canvas text-[13px]"><span className="font-medium">{i.number || `Draft #${i.id}`}</span><span className="text-muted"> · {i.customer}</span></button>)}
        </div>
      )}
    </div>
  );
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="flex items-center gap-2 pl-1 cursor-pointer hover:opacity-90 transition-opacity"
      >
        <div className="w-7 h-7 rounded-full bg-[#3d2348] text-white flex items-center justify-center text-xs font-bold shadow-xs">
          {initials(user.name)}
        </div>
        <span className="text-xs font-semibold text-slate-800 hidden sm:inline">{user.name}</span>
        <ChevronDown size={13} className="text-slate-500" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-56 bg-white border border-line rounded-xl shadow-l2 py-2 z-40">
          <div className="px-4 py-2 border-b border-line mb-1">
            <div className="text-[13px] font-medium">{user.name}</div>
            <div className="text-[12px] text-muted truncate">{user.email}</div>
            <div className="mt-1.5"><Badge tone={user.role === 'ADMIN' ? 'plum' : user.role === 'STAFF' ? 'teal' : 'gray'}>{user.role}</Badge></div>
          </div>
          <button onMouseDown={onLogout} className="w-full text-left px-4 py-2 text-[13px] hover:bg-canvas flex items-center gap-2 text-bad"><LogOut size={14} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

function ClockChip({ onOpenTimeTravel }) {
  const { data } = useQuery(() => api.billingRuns(), []);
  const todayStr = data?.today ? fmtDate(data.today) : '31 Oct 2026';
  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium shadow-2xs ${
        data?.clock ? 'border-amber-300 bg-amber-50 text-amber-900 font-semibold' : 'border-slate-200 bg-white text-slate-600'
      }`}>
        <Calendar size={13} className={data?.clock ? 'text-amber-600' : 'text-slate-400'} />
        <span>{data?.clock ? 'Simulated: ' : 'Today: '}{todayStr}</span>
      </div>
      <button
        type="button"
        onClick={onOpenTimeTravel}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        title="Open Time Travel Sandbox & Billing Engine"
      >
        <Clock size={13} className="text-purple-600" />
        <span>Time Travel</span>
      </button>
    </div>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [timeTravelOpen, setTimeTravelOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  // Global keyboard shortcut Ctrl+J for AI Copilot
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setCopilotOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const sidebar = (
    <aside className="w-[260px] h-full bg-[#1a0f21] text-slate-300 flex-shrink-0 flex flex-col justify-between relative sidebar-bg-glow border-r border-[#2d1b38] select-none">
      <div className="overflow-y-auto">
        {/* Brand Logo */}
        <div className="px-6 py-5 flex items-center gap-2.5">
          <Link to="/app" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white border border-white/15 group-hover:scale-105 transition-transform">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67M2.5 22v-6h6M2.66 8.43a10 10 0 0 1 .57 8.38L-2.44 22.48" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white font-sans">subsync</span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 space-y-6 mt-1 text-sm font-medium" aria-label="Main navigation">
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="px-3 text-[11px] font-bold text-slate-400/80 tracking-wider uppercase mb-2">
                {g.group}
              </div>
              <div className="space-y-1">
                {g.items.filter((i) => !i.admin || isAdmin).map((i) => (
                  <NavLink
                    key={i.to}
                    to={i.to}
                    end={i.end}
                    onClick={() => setMobile(false)}
                    className={({ isActive }) =>
                      isActive
                        ? 'flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#6b2568] to-[#4e1d4d] text-white shadow-sm font-semibold transition-all'
                        : 'flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-medium'
                    }
                  >
                    <i.icon size={16} />
                    <span>{i.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Sidebar Bottom Promo & Footer */}
      <div className="p-4 mt-auto">
        <div className="bg-gradient-to-br from-[#3b1a47]/90 to-[#23122c]/90 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md relative overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-amber-300 mb-2.5">
            <Crown size={15} className="fill-current" />
          </div>
          <h4 className="text-white text-sm font-semibold mb-1">SubSync Enterprise</h4>
          <p className="text-slate-300/80 text-[11px] leading-relaxed mb-3">
            AI Copilot, Bharat UPI &amp; Real-time Forecasting Active.
          </p>
          <button
            type="button"
            onClick={() => setCopilotOpen(true)}
            className="w-full bg-white text-slate-900 hover:bg-slate-100 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <span>Launch AI Copilot</span>
            <Sparkles size={13} className="text-purple-600" />
          </button>
        </div>

        <div className="mt-4 px-1 flex items-center gap-2 text-slate-400 text-xs">
          <Building2 size={16} className="text-slate-400/80" />
          <div className="truncate">
            <span className="font-medium text-slate-200">Brightloop Software</span>
            <span className="text-[10px] text-slate-400 block -mt-0.5">GSTIN 32ABCDE1234F1Z5 · v2.4.0</span>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-[#f5f2fb]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed inset-y-0 left-0 z-30 no-print">{sidebar}</div>

      {/* Mobile Drawer */}
      {mobile && (
        <div className="lg:hidden fixed inset-0 z-40 flex no-print">
          <div className="fixed inset-0 bg-charcoal/60 backdrop-blur-xs" onClick={() => setMobile(false)} />
          <div className="relative z-10">{sidebar}</div>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-[260px] min-w-0">
        {/* Top Global Header */}
        <header className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 border-b border-purple-100/60 bg-white/70 backdrop-blur-md sticky top-0 z-20 no-print">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-slate-600 hover:text-slate-900" onClick={() => setMobile(true)} aria-label="Open navigation menu">
              <Menu size={20} />
            </button>
            <GlobalSearch />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* AI Copilot Pill Button */}
            <button
              onClick={() => setCopilotOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-pink-200 bg-pink-50/70 text-slate-700 text-xs font-medium hover:bg-pink-100/70 transition-colors shadow-2xs cursor-pointer"
              title="SubSync AI Revenue Intelligence (Ctrl+J)"
            >
              <span className="text-pink-600 text-xs font-semibold flex items-center gap-1">
                <Sparkles size={13} className="text-pink-500 animate-pulse" /> AI Copilot
              </span>
              <kbd className="text-[10px] bg-white border border-pink-200/80 rounded px-1 py-0.2 text-slate-500 font-semibold hidden sm:inline">Ctrl J</kbd>
            </button>

            {/* Date and Time Travel */}
            <ClockChip onOpenTimeTravel={() => setTimeTravelOpen(true)} />

            {/* Notification Bell */}
            <button className="relative p-1.5 text-slate-500 hover:text-slate-800 transition-colors rounded-lg" title="Notifications">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-3 h-3 bg-rose-500 text-[8px] font-bold text-white rounded-full flex items-center justify-center">1</span>
            </button>

            {/* User Profile */}
            <UserMenu user={user} onLogout={() => { logout(); nav('/login'); }} />
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-7 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* AI Copilot & Time Travel Modals */}
      <AICopilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />
      <TimeTravelModal open={timeTravelOpen} onClose={() => setTimeTravelOpen(false)} />
    </div>
  );
}

export function PortalShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const link = ({ isActive }) => `px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors ${isActive ? 'bg-purple-100 text-purple-900 font-semibold' : 'text-slate-700 hover:bg-slate-100'}`;
  return (
    <div className="min-h-screen bg-[#f5f2fb]">
      <header className="bg-white/80 backdrop-blur-md border-b border-purple-100 sticky top-0 z-20 no-print">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2 sm:gap-4">
          <Link to="/portal" className="flex items-center gap-2 font-bold text-slate-900">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#581C87] to-[#7E22CE] text-white flex items-center justify-center text-xs">
              S
            </div>
            <span>subsync</span>
          </Link>
          <nav className="flex items-center gap-1 sm:ml-4">
            <NavLink to="/portal" end className={link}>Subscriptions</NavLink>
            <NavLink to="/portal/invoices" className={link}>Invoices</NavLink>
          </nav>
          <div className="flex-1" />
          <UserMenu user={user} onLogout={() => { logout(); nav('/login'); }} />
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4 sm:p-6"><Outlet /></main>
    </div>
  );
}
