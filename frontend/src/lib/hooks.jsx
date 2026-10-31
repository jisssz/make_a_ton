import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, getUser, subscribeData } from '../data/api';
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react';

/** Loads data and reloads automatically whenever the data changes. */
export function useQuery(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const load = useCallback(() => {
    let alive = true;
    fnRef.current()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState((s) => ({ data: s.data, loading: false, error })));
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    const cancel = load();
    const unsub = subscribeData(load);
    return () => { cancel(); unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ...state, reload: load };
}

/* ------------------------------- auth -------------------------------- */
const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser());
  const value = {
    user,
    login: async (e, p) => { const u = await api.login(e, p); setUser(u); return u; },
    signup: async (d) => { const u = await api.signup(d); setUser(u); return u; },
    logout: () => { api.logout(); setUser(null); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

/* ------------------------------- toasts ------------------------------ */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'success', ms = 4000) => {
    const id = Math.random();
    setItems((x) => [...x, { id, message, type }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), ms);
  }, []);
  const icon = { success: CheckCircle2, error: CircleAlert, info: Info };
  const tone = { success: 'text-ok', error: 'text-bad', info: 'text-teal' };
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))] no-print" aria-live="polite">
        {items.map((t) => {
          const I = icon[t.type];
          return (
            <div key={t.id} className="bg-white border border-line rounded-lg shadow-l2 px-4 py-3 flex items-start gap-3 text-[13px]">
              <I size={18} className={`${tone[t.type]} mt-0.5 shrink-0`} />
              <div className="flex-1">{t.message}</div>
              <button onClick={() => setItems((x) => x.filter((y) => y.id !== t.id))} className="text-muted hover:text-charcoal" aria-label="Dismiss"><X size={16} /></button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** Wraps an async action: shows toast on error, returns field errors for forms. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const exec = useCallback(async (fn, successMsg) => {
    setBusy(true);
    setFieldErrors({});
    try {
      const r = await fn();
      if (successMsg) toast(typeof successMsg === 'function' ? successMsg(r) : successMsg);
      return { ok: true, result: r };
    } catch (e) {
      if (e.fields) setFieldErrors(e.fields);
      toast(e.message || 'Something went wrong', 'error');
      return { ok: false, error: e };
    } finally { setBusy(false); }
  }, [toast]);
  return { exec, busy, fieldErrors, setFieldErrors };
}
