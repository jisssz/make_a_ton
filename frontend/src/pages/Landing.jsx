import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';

/* Colourful module icons in the style of the reference design */
const APPS = [
  ['Subscriptions', <><path d="M12 24C12 17.4 17.4 12 24 12C28.2 12 31.8 14.1 33.9 17.4" stroke="#F59E0B" strokeLinecap="round" strokeWidth="4.5" /><path d="M36 24C36 30.6 30.6 36 24 36C19.8 36 16.2 33.9 14.1 30.6" stroke="#10B981" strokeLinecap="round" strokeWidth="4.5" /><polygon fill="#F59E0B" points="34,12 37,20 29,19" /><polygon fill="#10B981" points="14,36 11,28 19,29" /></>],
  ['Quotations', <><rect fill="#8B5CF6" height="28" rx="3" width="16" x="12" y="10" /><rect fill="#06B6D4" height="28" opacity="0.85" rx="3" width="16" x="20" y="10" /><path d="M20 28L28 22L36 28V38H20V28Z" fill="#10B981" /></>],
  ['Invoicing', <><circle cx="16" cy="18" fill="#F59E0B" r="6" /><rect fill="#06B6D4" height="24" rx="4" transform="rotate(-30 22 14)" width="8" x="22" y="14" /><circle cx="32" cy="30" fill="#0D9488" r="6" /></>],
  ['Payments', <><rect fill="#0D9488" height="7" rx="3" width="24" x="12" y="16" /><rect fill="#881337" height="8" rx="3" width="24" x="12" y="25" /></>],
  ['Plans', <><path d="M10 20L24 10L38 20L24 30L10 20Z" fill="#06B6D4" /><path d="M16 25L24 32L32 25L38 29L24 39L10 29L16 25Z" fill="#6366F1" /></>],
  ['Discounts', <><rect fill="#3B82F6" height="28" rx="4" transform="rotate(45 20 10)" width="8" x="20" y="10" /><rect fill="#EC4899" height="28" rx="4" transform="rotate(-45 10 24)" width="8" x="10" y="24" /></>],
  ['Products', <><path d="M24 10L36 17V31L24 38L12 31V17L24 10Z" fill="#F97316" /><path d="M24 10L36 17L24 24L12 17L24 10Z" fill="#FDBA74" /><path d="M24 24V38L12 31V17L24 24Z" fill="#EA580C" /></>],
  ['Billing Run', <><rect fill="#06B6D4" height="14" rx="2" width="7" x="12" y="24" /><rect fill="#14B8A6" height="20" rx="2" width="7" x="21" y="18" /><rect fill="#F97316" height="16" rx="2" width="7" x="30" y="22" /></>],
  ['Revenue', <><rect fill="#881337" height="12" rx="2" width="6" x="12" y="26" /><rect fill="#DC2626" height="19" rx="2" width="6" x="21" y="19" /><rect fill="#F59E0B" height="24" rx="2" width="6" x="30" y="14" /></>],
  ['GST & Taxes', <><path d="M12 28C15 22 18 16 22 16C26 16 22 32 20 32C18 32 24 24 36 24" stroke="#0284C7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" /><circle cx="35" cy="18" fill="#0284C7" r="3" /></>],
  ['Customer Portal', <><circle cx="24" cy="18" fill="#7C3AED" r="5" /><path d="M15 32C15 28 19 26 24 26C29 26 33 28 33 32" stroke="#06B6D4" strokeLinecap="round" strokeWidth="4.5" /></>],
  ['Dashboard', null],
];

function AppTile({ name, svg }) {
  return (
    <div className="flex flex-col items-center group">
      <div className="w-20 h-20 bg-white rounded-2xl shadow-sm flex items-center justify-center p-4 transition-transform group-hover:scale-110 group-hover:shadow-md">
        {svg ? <svg className="w-12 h-12" fill="none" viewBox="0 0 48 48">{svg}</svg> : (
          <div className="grid grid-cols-2 gap-1.5 w-8 h-8">
            <div className="w-3.5 h-3.5 bg-rose-500 rounded-sm" /><div className="w-3.5 h-3.5 bg-sky-400 rounded-sm" />
            <div className="w-3.5 h-3.5 bg-teal-400 rounded-sm" /><div className="w-3.5 h-3.5 bg-amber-400 rounded-sm" />
          </div>
        )}
      </div>
      <span className="mt-3 text-[15px] font-semibold text-gray-800 text-center">{name}</span>
    </div>
  );
}

const BEFORE = [
  'Subscriptions tracked in a spreadsheet',
  'Renewals remembered by whoever notices',
  'Invoices typed by hand every month',
  'Payments matched by scrolling bank statements',
  'Revenue reports built at quarter end',
];

const FEATURES = [
  { title: 'One-click billing run', text: 'Every due subscription is invoiced exactly once — with catch-up for missed periods and a unique-period guard that makes double billing impossible.', tone: 'bg-purple-50 text-plum', d: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { title: 'GST-ready invoices', text: 'Taxes apply automatically from admin rules — CGST + SGST within Kerala, IGST across states — with discounts applied before tax.', tone: 'bg-amber-50 text-amber-600', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { title: 'Billing Control Centre', text: 'Renewals due, overdue invoices, drafts to confirm and revenue-leakage alerts — the next action is always one click away.', tone: 'bg-cyan-50 text-cyan-600', d: 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
];

export default function Landing() {
  const [without, setWithout] = useState(false);
  return (
    <div className="bg-white text-charcoal overflow-x-hidden selection:bg-gold">
      <header className="w-full bg-white relative z-50">
        <div className="max-w-[1400px] mx-auto px-6 sm:px-10 h-20 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center space-x-8 text-[15px] font-medium text-gray-700">
            <a className="hover:text-plum" href="#apps">Apps</a>
            <a className="hover:text-plum" href="#how">How it works</a>
            <a className="hover:text-plum" href="#features">Features</a>
          </nav>
          <div className="flex items-center space-x-6 text-[15px]">
            <Link className="hidden sm:inline-block font-medium text-gray-700 hover:text-plum" to="/login">Sign in</Link>
            <Link className="inline-flex items-center px-5 py-2.5 rounded-lg bg-plum text-white font-medium hover:bg-plum-dark shadow-sm" to="/signup">Try it free</Link>
          </div>
        </div>
      </header>

      <section className="relative pt-12 pb-16 md:pt-20 md:pb-24">
        <div className="max-w-[1300px] mx-auto px-6 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-[64px] font-bold tracking-tight leading-[1.25] sm:leading-[1.2] mb-3">
            All your subscriptions on <span className="hl-yellow px-2.5 mx-1">one platform.</span>
          </h1>
          <h2 className="text-4xl sm:text-5xl lg:text-[64px] font-bold tracking-tight leading-[1.25] sm:leading-[1.2] mb-12">
            Simple, efficient, yet <span className="ul-cyan pb-1">reliable!</span>
          </h2>
          <div className="relative inline-flex flex-col sm:flex-row items-center justify-center gap-4 mt-2 mb-8">
            <Link className="w-full sm:w-auto px-7 py-3.5 rounded-lg bg-plum text-white text-[17px] font-medium shadow-md hover:bg-plum-dark transition-all hover:-translate-y-0.5" to="/signup">Start now - It&apos;s free</Link>
            <Link className="w-full sm:w-auto px-7 py-3.5 rounded-lg bg-plum-soft text-charcoal text-[17px] font-medium hover:bg-[#EBE2EB]" to="/login">See the live demo</Link>
            <div className="absolute sm:-bottom-14 sm:-right-64 hidden sm:flex items-center gap-2 pointer-events-none text-left">
              <svg className="w-14 h-16 text-plum -rotate-12 translate-y-3" fill="none" viewBox="0 0 70 80"><path d="M55 70C35 48 18 30 14 12M14 12L25 15M14 12L10 24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
              <div className="font-hand text-xl sm:text-2xl font-bold text-plum leading-snug">1,000s of invoices<br /><span className="text-2xl sm:text-3xl">in ONE click</span></div>
            </div>
          </div>
          <div className="sm:hidden font-hand text-xl font-bold text-plum mt-3">1,000s of invoices in ONE click</div>
        </div>
      </section>

      <section id="apps" className="relative pt-12 pb-16 bg-[#F3F4F6] curved-top">
        <div className="max-w-[1300px] mx-auto px-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-8 justify-items-center mb-12">
            {APPS.map(([n, s]) => <AppTile key={n} name={n} svg={s} />)}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-gray-200/80 max-w-4xl mx-auto px-4 gap-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <button type="button" role="switch" aria-checked={without} onClick={() => setWithout(!without)}
                className={`w-12 h-6 rounded-full p-0.5 transition-colors flex items-center ${without ? 'bg-plum' : 'bg-gray-300'}`}>
                <span className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${without ? 'translate-x-6' : ''}`} />
              </button>
              <span className="text-[15px] font-medium">Imagine without SubSync</span>
            </label>
            <Link className="inline-flex items-center text-[15px] font-semibold text-plum gap-2 group" to="/login">
              Open the app <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
            </Link>
          </div>
          {without && (
            <div className="max-w-4xl mx-auto mt-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {BEFORE.map((b) => <div key={b} className="bg-white rounded-xl border border-gray-200 p-4 text-[14px] text-gray-700"><span className="font-hand text-lg text-[#C75C55] block">✗ ugh…</span>{b}</div>)}
            </div>
          )}
        </div>
      </section>

      <section id="how" className="py-20 md:py-28 bg-white">
        <div className="max-w-[900px] mx-auto px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-snug mb-5">One place for the whole billing month.</h2>
          <p className="text-lg sm:text-xl text-gray-700 leading-relaxed mb-6">Set up products and plans. Turn a quotation into a subscription.<br />Bill everyone on time, record payments, and see what is overdue.</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-left mt-10">
            {['Plan', 'Quote', 'Subscribe', 'Invoice', 'Get paid'].map((s, i) => (
              <div key={s} className="rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="font-hand text-2xl text-plum font-bold">{i + 1}.</div>
                <div className="font-semibold">{s}</div>
              </div>
            ))}
          </div>
          <div className="relative inline-block text-left mt-14">
            <div className="absolute -left-7 -top-4 w-16 h-16 bg-gold rounded-2xl -rotate-12 -z-10" />
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 max-w-lg">
              <p className="font-hand text-xl font-bold text-gray-900 leading-snug">“No missed renewals. No wrong invoices. Recurring revenue you can actually see.”</p>
              <p className="text-xs text-gray-500 font-medium mt-1">— What Brightloop needed, built in a day</p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <div className="text-4xl sm:text-6xl md:text-7xl font-hand font-bold leading-tight inline-block">
            <span className="hl-coral px-3">Level up</span><span className="mx-2">your quality of</span><span className="ul-turq">work</span>
          </div>
        </div>
      </section>

      <section id="features" className="py-16 bg-[#F9F8FA] border-t border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h3 className="text-xs font-bold uppercase tracking-widest text-plum mb-3">Built for subscription businesses in India</h3>
            <h2 className="text-3xl sm:text-4xl font-bold">All your billing, tax and renewal needs.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-xl ${f.tone} flex items-center justify-center mb-5`}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d={f.d} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>
                </div>
                <h4 className="text-xl font-bold mb-2">{f.title}</h4>
                <p className="text-gray-600 text-sm leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 pt-10 border-t border-gray-200/70 flex flex-wrap items-center justify-center gap-8 sm:gap-16 text-gray-500 text-xs font-semibold tracking-wider uppercase">
            {['No double billing', 'Role-based access', 'Pages under 2 seconds'].map((t) => (
              <span key={t} className="flex items-center gap-2"><svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd" /></svg>{t}</span>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-[1300px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <p className="text-xs text-gray-500">SubSync for Brightloop Software · Odoo x Make-a-ton 9.0 · Simple, efficient, yet reliable.</p>
          <div className="text-xs text-gray-500">English (IN) • ₹ INR</div>
        </div>
      </footer>
    </div>
  );
}
