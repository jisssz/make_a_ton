import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, Check, X, Mail, Lock, LogIn, Sparkles, User, Users, Shield, ArrowLeft } from 'lucide-react';
import { useAuth, useAction, useToast } from '../../lib/hooks';
import { api, isDemoMode } from '../../data/api';
import { passwordChecks, isStrongPassword, EMAIL_RE } from '../../lib/validate';

function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="relative w-full min-h-screen flex flex-col lg:flex-row overflow-hidden bg-[#FBF9FD] text-slate-800 antialiased selection:bg-purple-200 selection:text-purple-900 font-sans">
      {/* LEFT COLUMN: Sign-In Form & Brand Header */}
      <div className="relative w-full lg:w-[46%] min-h-screen bg-[#FBF9FD] flex flex-col justify-between p-8 sm:p-12 lg:px-14 xl:px-20 z-10">
        {/* Ambient background curves */}
        <div className="absolute -bottom-24 -left-20 w-96 h-96 bg-purple-100/60 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-1/4 -right-16 w-80 h-80 bg-purple-50/80 rounded-full blur-2xl pointer-events-none -z-10" />

        {/* Top Header: Logo & Platform Subtitle */}
        <header className="flex items-center gap-4 pt-2">
          <Link to="/" className="flex items-center gap-3 group">
            {/* Logo Mark Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#581C87] to-[#7E22CE] flex items-center justify-center shadow-md shadow-purple-900/10 group-hover:scale-105 transition-transform">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {/* Brand Wordmark */}
            <span className="text-2xl font-bold tracking-tight text-slate-900">subsync</span>
          </Link>
          {/* Vertical Divider */}
          <div className="h-5 w-[1.5px] bg-slate-200" />
          {/* Tagline */}
          <span className="text-sm font-medium text-slate-400 hidden sm:inline">Subscription &amp; Billing Platform</span>
        </header>

        {/* Main Form Section */}
        <section className="max-w-[420px] w-full my-auto py-8 sm:py-10">
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-[15px] text-slate-500 font-normal">
                {subtitle}
              </p>
            )}
          </div>

          {children}
        </section>

        {/* Bottom Spacer */}
        <div className="h-6" />
      </div>

      {/* RIGHT COLUMN: Showcase & Value Proposition */}
      <div className="relative w-full lg:w-[54%] min-h-screen bg-gradient-to-br from-[#2D0B36] via-[#1F0726] to-[#120317] text-white flex flex-col justify-between p-8 sm:p-12 lg:p-14 xl:p-16 overflow-hidden">
        {/* Flowing Organic Wave Background Curves */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <svg className="w-full h-full object-cover" fill="none" preserveAspectRatio="none" viewBox="0 0 1000 1000">
            <path d="M-100,200 C300,50 600,600 1100,100 L1100,1100 L-100,1100 Z" fill="url(#gradWave1)" opacity="0.3" />
            <path d="M-50,650 C250,300 700,750 1150,400 L1150,1100 L-50,1100 Z" fill="url(#gradWave2)" opacity="0.2" />
            <defs>
              <linearGradient id="gradWave1" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#9333ea" />
                <stop offset="100%" stopColor="#3b0764" />
              </linearGradient>
              <linearGradient id="gradWave2" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#581c87" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Top Right Trust Badge */}
        <div className="w-full flex justify-end z-20">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs font-medium text-purple-100 shadow-lg">
            <svg className="w-3.5 h-3.5 text-purple-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4 18h2V10H4v8zm5 0h2V6H9v12zm5 0h2v-5h-2v5zm5 0h2V2h-2v16z" />
            </svg>
            <span>Trusted by teams</span>
            <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            <span className="font-bold text-white">4.8/5</span>
          </div>
        </div>

        {/* Center Showcase Content: Headline & 3D Tilt Mockup */}
        <div className="my-auto py-6 z-10 max-w-xl">
          {/* Big Hero Headline */}
          <div className="mb-4">
            <h2 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold tracking-tight leading-[1.15] text-white">
              Bill on time. <br />
              <span className="yellow-highlight text-black mt-2 inline-block font-extrabold tracking-tight">Every time.</span>
            </h2>
            <p className="mt-4 text-purple-200/85 text-base sm:text-[17px] leading-relaxed font-normal max-w-lg">
              A simple, reliable platform to manage subscriptions, invoices, and customer billing — all in one place.
            </p>
          </div>

          {/* 3D Perspective Dashboard Window Mockup */}
          <div className="dashboard-perspective-container pt-4 pb-2">
            <div className="mockup-3d-card w-full max-w-[530px] rounded-2xl bg-[#F8F9FD] text-slate-800 p-5 overflow-hidden border border-white/20">
              {/* Window Top Mac Bar */}
              <div className="flex items-center gap-1.5 pb-3 border-b border-slate-100">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>

              {/* Mockup Inner App Layout */}
              <div className="flex pt-3.5 gap-4">
                {/* App Left Sidebar */}
                <div className="w-32 flex-shrink-0 flex flex-col space-y-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 mb-2">
                    <div className="w-4 h-4 rounded-md bg-purple-700 flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-900 tracking-tight">subsync</span>
                  </div>

                  {/* Nav Items */}
                  <div className="px-2.5 py-1.5 rounded-lg bg-purple-800 text-white flex items-center gap-2 text-[11px] font-semibold">
                    <svg className="w-3 h-3 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    Dashboard
                  </div>
                  <div className="px-2.5 py-1 rounded-lg text-slate-600 flex items-center gap-2 text-[11px] font-medium">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    Subscriptions
                  </div>
                  <div className="px-2.5 py-1 rounded-lg text-slate-600 flex items-center gap-2 text-[11px] font-medium">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    Invoices
                  </div>
                  <div className="px-2.5 py-1 rounded-lg text-slate-600 flex items-center gap-2 text-[11px] font-medium">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    Customers
                  </div>
                  <div className="px-2.5 py-1 rounded-lg text-slate-600 flex items-center gap-2 text-[11px] font-medium">
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    </svg>
                    Reports
                  </div>
                </div>

                {/* App Main Body with Metrics and Graph */}
                <div className="flex-1 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Active Subscriptions</div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-base font-bold text-slate-900">1,248</span>
                        <span className="text-[10px] font-bold text-emerald-600">↑ +12%</span>
                      </div>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Revenue (MTD)</div>
                      <div className="flex items-baseline justify-between mt-1">
                        <span className="text-base font-bold text-slate-900">₹4,92,000</span>
                        <span className="text-[10px] font-bold text-emerald-600">↑ +8.4%</span>
                      </div>
                    </div>
                  </div>

                  {/* Trend Line Graph Card */}
                  <div className="p-2.5 bg-white rounded-xl border border-slate-100 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="h-2 w-14 bg-slate-100 rounded" />
                      <div className="h-2 w-8 bg-slate-100 rounded" />
                    </div>
                    {/* SVG Area Chart */}
                    <div className="h-20 w-full relative">
                      <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 280 80">
                        <defs>
                          <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#C084FC" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#C084FC" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <path d="M 0,65 C 20,62 30,55 50,56 C 70,57 90,68 115,64 C 140,58 150,35 180,36 C 210,38 230,22 250,23 C 265,24 275,30 280,35 L 280,80 L 0,80 Z" fill="url(#chartGradient)" />
                        <path d="M 0,65 C 20,62 30,55 50,56 C 70,57 90,68 115,64 C 140,58 150,35 180,36 C 210,38 230,22 250,23 C 265,24 275,30 280,35" fill="none" stroke="#A855F7" strokeLinecap="round" strokeWidth="2.5" />
                        <circle cx="250" cy="23" fill="#7E22CE" r="3.5" stroke="#FFFFFF" strokeWidth="2" />
                      </svg>
                    </div>
                    <div className="flex gap-2 mt-2 pt-1 border-t border-slate-50">
                      <div className="h-1.5 w-7 bg-slate-100 rounded" />
                      <div className="h-1.5 w-7 bg-slate-100 rounded" />
                      <div className="h-1.5 w-7 bg-slate-100 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Feature Highlights */}
        <footer className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-white/10 z-10">
          <div className="space-y-1 md:pr-4 md:border-r md:border-white/10">
            <div className="text-white mb-2">
              <svg className="w-5 h-5 text-purple-200" fill="currentColor" viewBox="0 0 20 20">
                <path clipRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" fillRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">Automated Billing</h3>
            <p className="text-xs text-purple-200/70">Save time &amp; reduce errors</p>
          </div>

          <div className="space-y-1 md:pr-4 md:border-r md:border-white/10">
            <div className="text-white mb-2">
              <svg className="w-5 h-5 text-purple-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">Period Guard</h3>
            <p className="text-xs text-purple-200/70">Prevent duplicate billing</p>
          </div>

          <div className="space-y-1">
            <div className="text-white mb-2">
              <svg className="w-5 h-5 text-purple-200" fill="currentColor" viewBox="0 0 24 24">
                <path d="M4 19h16v2H4zM6 10h3v7H6zm5-4h3v11h-3zm5-3h3v14h-3z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white tracking-wide">Subscription Control</h3>
            <p className="text-xs text-purple-200/70">Create, track, and renew easily</p>
          </div>
        </footer>
      </div>
    </main>
  );
}

const DEMO = [
  { role: 'Admin', email: 'admin@subsync.in', password: 'Admin@12345', icon: Shield },
  { role: 'Staff', email: 'staff@subsync.in', password: 'Staff@12345', icon: Users },
  { role: 'Customer', email: 'customer@subsync.in', password: 'Customer@123', icon: User },
];

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const { exec, busy } = useAction();
  const [f, setF] = useState({ email: 'admin@subsync.in', password: 'Admin@12345' });
  const [selectedRole, setSelectedRole] = useState('Admin');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [err, setErr] = useState({});

  const selectDemo = (role, email, password) => {
    setSelectedRole(role);
    setF({ email, password });
    setErr({});
  };

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!EMAIL_RE.test(f.email)) v.email = 'Enter a valid email address';
    if (!f.password) v.password = 'Password is required';
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(() => login(f.email, f.password));
    if (r.ok) nav(r.result.role === 'CUSTOMER' ? '/portal' : '/app');
  };

  return (
    <AuthLayout
      title={<>Welcome back <span className="text-3xl">👋</span></>}
      subtitle="Sign in to manage subscriptions, billing, and customers."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {/* Email Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2" htmlFor="email">
            Email <span className="text-red-500 font-bold">*</span>
          </label>
          <div className={`relative rounded-xl border ${err.email ? 'border-red-400 bg-red-50/20' : 'border-purple-200/90 bg-white'} shadow-xs focus-within:ring-2 focus-within:ring-purple-600 focus-within:border-transparent transition-all`}>
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={f.email}
              onChange={(e) => {
                setF({ ...f, email: e.target.value });
                setSelectedRole(null);
              }}
              placeholder="you@company.com"
              className="w-full pl-10 pr-4 py-3 bg-transparent rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none border-none ring-0 focus:ring-0"
            />
          </div>
          {err.email && <div className="text-xs text-red-500 mt-1 font-medium">{err.email}</div>}
        </div>

        {/* Password Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2" htmlFor="password">
            Password <span className="text-red-500 font-bold">*</span>
          </label>
          <div className={`relative rounded-xl border ${err.password ? 'border-red-400 bg-red-50/20' : 'border-purple-200/90 bg-white'} shadow-xs focus-within:ring-2 focus-within:ring-purple-600 focus-within:border-transparent transition-all`}>
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={f.password}
              onChange={(e) => {
                setF({ ...f, password: e.target.value });
                setSelectedRole(null);
              }}
              placeholder="Enter your password"
              className="w-full pl-10 pr-10 py-3 bg-transparent rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none border-none ring-0 focus:ring-0"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {err.password && <div className="text-xs text-red-500 mt-1 font-medium">{err.password}</div>}
        </div>

        {/* Remember Me & Forgot Password */}
        <div className="flex items-center justify-between text-sm pt-1">
          <label className="flex items-center cursor-pointer select-none text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-purple-300 text-purple-700 focus:ring-purple-600 transition-all cursor-pointer"
            />
            <span className="ml-2 text-sm text-slate-700 font-medium">Remember me</span>
          </label>
          <Link to="/forgot-password" className="text-sm font-semibold text-[#7E22CE] hover:text-[#6B21A8] transition-colors">
            Forgot password?
          </Link>
        </div>

        {/* Submit CTA Button */}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#8B24A6] via-[#6F1D8A] to-[#4A1160] hover:from-[#9D2CBC] hover:to-[#571470] text-white font-semibold text-sm shadow-md shadow-purple-900/25 flex items-center justify-center gap-2.5 transition-all transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          <LogIn size={16} />
          <span>{busy ? 'Signing in…' : 'Sign in'}</span>
        </button>

        {/* Create Account Link */}
        <div className="text-center pt-2">
          <span className="text-sm text-slate-500">New customer? </span>
          <Link to="/signup" className="text-sm font-semibold text-[#7E22CE] hover:text-[#581C87] transition-colors">
            Create an account
          </Link>
        </div>
      </form>

      {/* Demo Accounts Section Box */}
      {isDemoMode && (
        <div className="mt-8 p-4 bg-white/70 border border-purple-200/80 rounded-2xl shadow-xs backdrop-blur-sm">
          <div className="flex items-center gap-1.5 mb-3 text-[11px] font-bold tracking-wider text-purple-900/80 uppercase">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Demo Accounts — Explore the Platform</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {DEMO.map(({ role, email, password, icon: Icon }) => {
              const active = selectedRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => selectDemo(role, email, password)}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-purple-50 border border-purple-300 font-bold text-purple-900 shadow-xs'
                      : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-purple-700' : 'text-slate-400'}`} />
                  <span>{role}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}

export function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const { exec, busy, fieldErrors } = useAction();
  const [f, setF] = useState({ name: '', company: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.name.trim()) v.name = 'Your name is required';
    if (!EMAIL_RE.test(f.email)) v.email = 'Enter a valid email address';
    if (!isStrongPassword(f.password)) v.password = 'Password does not meet all the rules';
    if (f.confirm !== f.password) v.confirm = 'Passwords do not match';
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(() => signup(f), 'Account created. Welcome to SubSync!');
    if (r.ok) nav('/portal');
  };

  const e2 = { ...fieldErrors, ...err };
  const pwRules = passwordChecks(f.password);

  return (
    <AuthLayout
      title="Create account"
      subtitle="See your subscriptions, invoices, and payments in one place."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Name <span className="text-red-500 font-bold">*</span>
            </label>
            <input
              className={`w-full px-3 py-2.5 rounded-xl border ${e2.name ? 'border-red-400 bg-red-50/20' : 'border-purple-200/90'} text-sm focus:ring-2 focus:ring-purple-600 focus:outline-none`}
              value={f.name}
              onChange={set('name')}
              placeholder="Jane Doe"
              autoComplete="name"
            />
            {e2.name && <div className="text-xs text-red-500 mt-1">{e2.name}</div>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Company
            </label>
            <input
              className="w-full px-3 py-2.5 rounded-xl border border-purple-200/90 text-sm focus:ring-2 focus:ring-purple-600 focus:outline-none"
              value={f.company}
              onChange={set('company')}
              placeholder="Acme Corp"
              autoComplete="organization"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Email <span className="text-red-500 font-bold">*</span>
          </label>
          <div className="relative rounded-xl border border-purple-200/90 bg-white">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              type="email"
              className={`w-full pl-9 pr-3 py-2.5 rounded-xl text-sm ${e2.email ? 'border-red-400 bg-red-50/20' : 'border-none'} focus:ring-2 focus:ring-purple-600 focus:outline-none`}
              value={f.email}
              onChange={set('email')}
              placeholder="jane@company.com"
              autoComplete="email"
            />
          </div>
          {e2.email && <div className="text-xs text-red-500 mt-1">{e2.email}</div>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Password <span className="text-red-500 font-bold">*</span>
          </label>
          <div className="relative rounded-xl border border-purple-200/90 bg-white">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm border-none focus:ring-2 focus:ring-purple-600 focus:outline-none"
              value={f.password}
              onChange={set('password')}
              placeholder="Create strong password"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {/* Real-time Password Rules Checklist */}
          <ul className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
            {pwRules.map((c) => (
              <li key={c.text} className={`flex items-center gap-1.5 text-[11px] ${c.ok ? 'text-ok font-medium' : 'text-slate-400'}`}>
                {c.ok ? <Check size={12} className="text-ok" /> : <X size={12} />}
                {c.text}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Confirm Password <span className="text-red-500 font-bold">*</span>
          </label>
          <input
            type="password"
            className={`w-full px-3 py-2.5 rounded-xl border ${e2.confirm ? 'border-red-400 bg-red-50/20' : 'border-purple-200/90'} text-sm focus:ring-2 focus:ring-purple-600 focus:outline-none`}
            value={f.confirm}
            onChange={set('confirm')}
            placeholder="Re-type your password"
            autoComplete="new-password"
          />
          {e2.confirm && <div className="text-xs text-red-500 mt-1">{e2.confirm}</div>}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#8B24A6] via-[#6F1D8A] to-[#4A1160] hover:from-[#9D2CBC] hover:to-[#571470] text-white font-semibold text-sm shadow-md shadow-purple-900/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <span>{busy ? 'Creating account…' : 'Create account'}</span>
        </button>

        <div className="text-center pt-1">
          <span className="text-sm text-slate-500">Already have an account? </span>
          <Link to="/login" className="text-sm font-semibold text-[#7E22CE] hover:text-[#581C87]">
            Sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(null);
  const { exec, busy } = useAction();

  const submit = async (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      setErr('Enter a valid email address');
      return;
    }
    setErr('');
    const r = await exec(() => api.forgotPassword(email));
    if (r.ok) setSent(r.result || {});
  };

  return (
    <AuthLayout
      title="Reset password"
      subtitle="We’ll email a single-use reset link to your registered email address."
    >
      {sent ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex gap-3 text-sm text-purple-900">
            <Mail className="text-purple-600 shrink-0 mt-0.5" size={20} />
            <p>
              If an account exists for <b>{email}</b>, a reset link is on its way. It works once and expires in 30 minutes.
            </p>
          </div>
          {sent.devLink && (
            <div className="border border-dashed border-amber-300 bg-amber-50/50 rounded-xl p-3 text-[13px]">
              <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mb-1">Demo Mail Outbox</div>
              <Link to={sent.devLink} className="text-purple-700 font-semibold hover:underline break-all">
                Open reset link directly
              </Link>
            </div>
          )}
          <Link
            to="/login"
            className="w-full py-3 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft size={16} /> Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Email Address <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="relative rounded-xl border border-purple-200/90 bg-white">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm ${err ? 'border-red-400 bg-red-50/20' : 'border-none'} focus:ring-2 focus:ring-purple-600 focus:outline-none`}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {err && <div className="text-xs text-red-500 mt-1">{err}</div>}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#8B24A6] via-[#6F1D8A] to-[#4A1160] hover:from-[#9D2CBC] hover:to-[#571470] text-white font-semibold text-sm shadow-md shadow-purple-900/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span>{busy ? 'Sending link…' : 'Send reset link'}</span>
          </button>

          <div className="text-center pt-2">
            <Link to="/login" className="text-sm font-semibold text-[#7E22CE] hover:underline flex items-center justify-center gap-1.5">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const { token } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { exec, busy } = useAction();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState({});

  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!isStrongPassword(pw)) v.pw = 'Password does not meet all the rules';
    if (confirm !== pw) v.confirm = 'Passwords do not match';
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(() => api.resetPassword(token, pw));
    if (r.ok) {
      toast('Password updated successfully. Please sign in.');
      nav('/login');
    }
  };

  const pwRules = passwordChecks(pw);

  return (
    <AuthLayout
      title="Set new password"
      subtitle="Choose a strong password with letters, numbers, and special characters."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            New Password <span className="text-red-500 font-bold">*</span>
          </label>
          <div className="relative rounded-xl border border-purple-200/90 bg-white">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              className="w-full pl-9 pr-10 py-2.5 rounded-xl text-sm border-none focus:ring-2 focus:ring-purple-600 focus:outline-none"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
            {pwRules.map((c) => (
              <li key={c.text} className={`flex items-center gap-1.5 text-[11px] ${c.ok ? 'text-ok font-medium' : 'text-slate-400'}`}>
                {c.ok ? <Check size={12} className="text-ok" /> : <X size={12} />}
                {c.text}
              </li>
            ))}
          </ul>
          {err.pw && <div className="text-xs text-red-500 mt-1">{err.pw}</div>}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Confirm Password <span className="text-red-500 font-bold">*</span>
          </label>
          <input
            type="password"
            className={`w-full px-3 py-2.5 rounded-xl border ${err.confirm ? 'border-red-400 bg-red-50/20' : 'border-purple-200/90'} text-sm focus:ring-2 focus:ring-purple-600 focus:outline-none`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm new password"
          />
          {err.confirm && <div className="text-xs text-red-500 mt-1">{err.confirm}</div>}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#8B24A6] via-[#6F1D8A] to-[#4A1160] hover:from-[#9D2CBC] hover:to-[#571470] text-white font-semibold text-sm shadow-md shadow-purple-900/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <span>{busy ? 'Updating…' : 'Update password'}</span>
        </button>
      </form>
    </AuthLayout>
  );
}
