import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, Check, X, Mail } from 'lucide-react';
import { Logo, Field } from '../../components/ui';
import { useAuth, useAction, useToast } from '../../lib/hooks';
import { api, isDemoMode } from '../../data/api';
import { passwordChecks, isStrongPassword, EMAIL_RE } from '../../lib/validate';

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      <div className="flex flex-col px-6 sm:px-12 py-8">
        <Logo />
        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm mx-auto py-10">
            <h1 className="text-[28px] leading-9 font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-muted mt-1 mb-7">{subtitle}</p>}
            {children}
          </div>
        </div>
      </div>
      <div className="hidden lg:flex relative bg-[#F3F4F6] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 curved-top bg-plum top-1/3" />
        <div className="relative text-center px-12">
          <p className="text-5xl font-bold tracking-tight leading-tight">Bill on time.<br /><span className="hl-yellow px-2">Every time.</span></p>
          <div className="mt-24 bg-white rounded-3xl p-6 shadow-xl max-w-md mx-auto text-left">
            <p className="font-hand text-xl font-bold leading-snug">“Run billing twice — still only one invoice per period.”</p>
            <p className="text-xs text-muted mt-1">Unique billing-period guard</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, error, label = 'Password', autoComplete = 'current-password', showRules }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={error} required>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete}
          className={`input pr-10 ${error ? 'input-error' : ''}`} />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {showRules && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
          {passwordChecks(value).map((c) => (
            <li key={c.text} className={`flex items-center gap-1.5 text-[12px] ${c.ok ? 'text-ok' : 'text-muted'}`}>
              {c.ok ? <Check size={12} /> : <X size={12} />}{c.text}
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}

const DEMO = [
  ['Admin', 'admin@subsync.in', 'Admin@12345'],
  ['Staff', 'staff@subsync.in', 'Staff@12345'],
  ['Customer', 'customer@subsync.in', 'Customer@123'],
];

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const { exec, busy } = useAction();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState({});
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
    <AuthLayout title="Welcome back" subtitle="Sign in to manage subscriptions and billing.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" error={err.email} required>
          <input type="email" className={`input ${err.email ? 'input-error' : ''}`} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
        </Field>
        <PasswordInput value={f.password} onChange={(password) => setF({ ...f, password })} error={err.password} />
        <div className="flex justify-end -mt-1"><Link to="/forgot-password" className="btn-link">Forgot password?</Link></div>
        <button className="btn-primary w-full h-10" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="text-[13px] text-muted mt-5 text-center">New customer? <Link to="/signup" className="btn-link">Create an account</Link></p>
      {isDemoMode && (
        <div className="mt-8 border border-dashed border-line rounded-lg p-3">
          <div className="micro mb-2">Demo accounts — click to fill</div>
          <div className="grid grid-cols-3 gap-2">
            {DEMO.map(([r, e, p]) => (
              <button key={r} type="button" onClick={() => setF({ email: e, password: p })} className="btn-secondary btn-sm">{r}</button>
            ))}
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
  return (
    <AuthLayout title="Create your account" subtitle="See your subscriptions and invoices in one place.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Your name" error={e2.name} required><input className={`input ${e2.name ? 'input-error' : ''}`} value={f.name} onChange={set('name')} autoComplete="name" /></Field>
          <Field label="Company"><input className="input" value={f.company} onChange={set('company')} autoComplete="organization" /></Field>
        </div>
        <Field label="Email" error={e2.email} required><input type="email" className={`input ${e2.email ? 'input-error' : ''}`} value={f.email} onChange={set('email')} autoComplete="email" /></Field>
        <PasswordInput value={f.password} onChange={(password) => setF({ ...f, password })} error={e2.password} autoComplete="new-password" showRules />
        <Field label="Confirm password" error={e2.confirm} required><input type="password" className={`input ${e2.confirm ? 'input-error' : ''}`} value={f.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
        <button className="btn-primary w-full h-10" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="text-[13px] text-muted mt-5 text-center">Already have an account? <Link to="/login" className="btn-link">Sign in</Link></p>
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
    if (!EMAIL_RE.test(email)) { setErr('Enter a valid email address'); return; }
    setErr('');
    const r = await exec(() => api.forgotPassword(email));
    if (r.ok) setSent(r.result || {});
  };
  return (
    <AuthLayout title="Reset your password" subtitle="We’ll email a reset link to your registered address.">
      {sent ? (
        <div className="space-y-4">
          <div className="card p-4 flex gap-3"><Mail className="text-teal shrink-0" size={20} /><p className="text-[14px]">If an account exists for <b>{email}</b>, a reset link is on its way. It works once and expires in 30 minutes.</p></div>
          {sent.devLink && (
            <div className="border border-dashed border-gold rounded-lg p-3 text-[13px]">
              <div className="micro mb-1">Demo mail outbox</div>
              <Link to={sent.devLink} className="btn-link break-all">Open reset link</Link>
            </div>
          )}
          <Link to="/login" className="btn-secondary w-full">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" error={err} required><input type="email" className={`input ${err ? 'input-error' : ''}`} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <button className="btn-primary w-full h-10" disabled={busy}>Send reset link</button>
          <Link to="/login" className="btn-link w-full justify-center">Back to sign in</Link>
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
  const [err, setErr] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!isStrongPassword(pw)) v.pw = 'Password does not meet all the rules';
    if (confirm !== pw) v.confirm = 'Passwords do not match';
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(() => api.resetPassword(token, pw));
    if (r.ok) { toast('Password updated. Please sign in.'); nav('/login'); }
  };
  return (
    <AuthLayout title="Choose a new password" subtitle="Make it strong — you’ll use it to sign in.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <PasswordInput label="New password" value={pw} onChange={setPw} error={err.pw} autoComplete="new-password" showRules />
        <Field label="Confirm password" error={err.confirm} required><input type="password" className={`input ${err.confirm ? 'input-error' : ''}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        <button className="btn-primary w-full h-10" disabled={busy}>Update password</button>
      </form>
    </AuthLayout>
  );
}
