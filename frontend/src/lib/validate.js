// Same rules are enforced again on the backend; the UI checks them for instant feedback.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const passwordChecks = (pw = '') => [
  { ok: pw.length > 8, text: 'More than 8 characters' },
  { ok: /[A-Z]/.test(pw), text: 'One uppercase letter' },
  { ok: /[a-z]/.test(pw), text: 'One lowercase letter' },
  { ok: /[^A-Za-z0-9]/.test(pw), text: 'One special character' },
];

export const isStrongPassword = (pw) => passwordChecks(pw).every((c) => c.ok);

/** Runs a map of field → [ruleFn(value, all) → message|null] and returns field → message. */
export const runRules = (values, rules) => {
  const errors = {};
  for (const [field, fns] of Object.entries(rules)) {
    for (const fn of fns) {
      const msg = fn(values[field], values);
      if (msg) { errors[field] = msg; break; }
    }
  }
  return errors;
};

export const required = (label) => (v) =>
  v === undefined || v === null || String(v).trim() === '' ? `${label} is required` : null;
export const minNum = (label, min) => (v) =>
  v !== '' && v !== undefined && Number(v) < min ? `${label} must be at least ${min}` : null;
export const isEmail = (v) => (v && !EMAIL_RE.test(v) ? 'Enter a valid email address' : null);
export const dateAfter = (label, otherField) => (v, all) =>
  v && all[otherField] && v < all[otherField] ? `${label} must be after the start date` : null;
