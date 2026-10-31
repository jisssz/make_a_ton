import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Repeat, FileText, Receipt, CreditCard, Package, UserPlus, Settings, Search,
  LogOut, Menu, Zap, Calendar, Sparkles, Clock,
} from 'lucide-react';
import { Logo, Badge } from './ui';
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
    <div className="relative w-full max-w-md">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="input h-8 pl-9 pr-14 bg-canvas" placeholder="Search customers, SUB-, INV/…" aria-label="Global search" />
      <kbd className="hidden md:block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted border border-line rounded px-1.5 bg-white">Ctrl K</kbd>
      {open && q.trim().length >= 2 && (
        <div className="absolute top-10 left-0 right-0 bg-white border border-line rounded-lg shadow-l2 py-2 z-40 max-h-96 overflow-y-auto">
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
      <button onClick={() => setOpen(!open)} onBlur={() => setTimeout(() => setOpen(false), 150)} className="flex items-center gap-2 hover:bg-canvas rounded px-1.5 py-1">
        <span className="w-7 h-7 rounded-full bg-plum text-white text-[11px] font-semibold flex items-center justify-center">{initials(user.name)}</span>
        <span className="hidden md:block text-[13px] font-medium">{user.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-10 w-56 bg-white border border-line rounded-lg shadow-l2 py-2 z-40">
          <div className="px-4 py-2 border-b border-line mb-1">
            <div className="text-[13px] font-medium">{user.name}</div>
            <div className="text-[12px] text-muted truncate">{user.email}</div>
            <div className="mt-1.5"><Badge tone={user.role === 'ADMIN' ? 'plum' : user.role === 'STAFF' ? 'teal' : 'gray'}>{user.role}</Badge></div>
          </div>
          <button onMouseDown={onLogout} className="w-full text-left px-4 py-2 text-[13px] hover:bg-canvas flex items-center gap-2"><LogOut size={14} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

function ClockChip({ onOpenTimeTravel }) {
  const { data } = useQuery(() => api.billingRuns(), []);
  if (!isDemoMode || !data) return null;
  return (
    <button
      type="button"
      onClick={onOpenTimeTravel}
      className={`hidden lg:flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded border transition-colors ${
        data.clock ? 'border-gold bg-[#FFF6E0] text-[#7a5200] font-medium' : 'border-line text-muted hover:text-charcoal hover:bg-canvas'
      }`}
      title="Click to launch Time Travel Sandbox & Billing Engine"
    >
      <Calendar size={13} /> {data.clock ? 'Simulated' : 'Today'}: <span className="num font-medium">{fmtDate(data.today)}</span>
      <span className="text-[10px] bg-white/80 px-1 py-0.2 rounded border border-line">⏱️ Time Travel</span>
    </button>
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
    <aside className="w-[250px] h-full bg-white border-r border-line flex flex-col">
      <div className="h-[52px] px-5 flex items-center border-b border-line"><Logo size="sm" to="/app" /></div>
      <nav className="flex-1 overflow-y-auto py-3 px-3" aria-label="Main">
        {NAV.map((g) => (
          <div key={g.group} className="mb-4">
            <div className="px-2.5 mb-1 micro">{g.group}</div>
            {g.items.filter((i) => !i.admin || isAdmin).map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} onClick={() => setMobile(false)}
                className={({ isActive }) => `flex items-center gap-2.5 px-2.5 py-2 rounded text-[13px] font-medium mb-0.5 transition-colors ${isActive ? 'bg-plum-subtle text-plum' : 'text-charcoal/80 hover:bg-canvas hover:text-charcoal'}`}>
                <i.icon size={16} />{i.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-line text-[12px] text-muted">
        <div className="font-medium text-charcoal">Brightloop Software</div>
        GSTIN 32ABCDE1234F1Z5 · Kerala
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:block fixed inset-y-0 left-0 z-30 no-print">{sidebar}</div>
      {mobile && (
        <div className="lg:hidden fixed inset-0 z-40 flex no-print">
          <div className="fixed inset-0 bg-charcoal/40" onClick={() => setMobile(false)} />
          <div className="relative">{sidebar}</div>
        </div>
      )}
      <div className="flex-1 lg:pl-[250px] min-w-0">
        <header className="h-[52px] bg-white border-b border-line sticky top-0 z-20 flex items-center gap-3 px-4 no-print">
          <button className="lg:hidden text-muted" onClick={() => setMobile(true)} aria-label="Open menu"><Menu size={20} /></button>
          <GlobalSearch />
          <div className="flex-1" />
          <button
            onClick={() => setCopilotOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium bg-plum-subtle text-plum border border-plum/30 hover:bg-plum hover:text-white transition-all shadow-xs"
            title="SubSync AI Revenue Intelligence (Ctrl+J)"
          >
            <Sparkles size={13} className="text-gold animate-pulse" />
            <span className="font-semibold">AI Copilot</span>
            <kbd className="hidden lg:inline text-[10px] bg-white text-charcoal border border-line rounded px-1 ml-0.5">Ctrl J</kbd>
          </button>
          <ClockChip onOpenTimeTravel={() => setTimeTravelOpen(true)} />
          <UserMenu user={user} onLogout={() => { logout(); nav('/login'); }} />
        </header>
        <main className="p-4 sm:p-6 max-w-[1400px] mx-auto">
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
  const link = ({ isActive }) => `px-3 py-1.5 rounded text-[13px] font-medium ${isActive ? 'bg-plum-subtle text-plum' : 'text-charcoal/80 hover:bg-canvas'}`;
  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-line sticky top-0 z-20 no-print">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-2 sm:gap-4">
          <Logo size="sm" to="/portal" compact />
          <nav className="flex items-center gap-1 sm:ml-2">
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
