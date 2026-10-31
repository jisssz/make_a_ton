import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { PageHeader, Modal, Field, Loading, Status, Badge } from '../../components/ui';
import { api } from '../../data/api';
import { useQuery, useAction, useAuth } from '../../lib/hooks';
import { initials } from '../../lib/format';
import { passwordChecks, isStrongPassword, EMAIL_RE } from '../../lib/validate';

function AddStaffModal({ onClose }) {
  const { exec, busy, fieldErrors } = useAction();
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'STAFF' });
  const [err, setErr] = useState({});
  const submit = async (e) => {
    e.preventDefault();
    const v = {};
    if (!f.name.trim()) v.name = 'Name is required';
    if (!EMAIL_RE.test(f.email)) v.email = 'Enter a valid email address';
    if (!isStrongPassword(f.password)) v.password = 'Password does not meet all the rules';
    setErr(v);
    if (Object.keys(v).length) return;
    const r = await exec(() => api.addStaff(f), (u) => `${u.name} can now sign in`);
    if (r.ok) onClose();
  };
  const e2 = { ...fieldErrors, ...err };
  return (
    <Modal open onClose={onClose} title="Add a team member"
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" form="staffform" disabled={busy}>Add member</button></>}>
      <form id="staffform" onSubmit={submit} className="space-y-3" noValidate>
        <Field label="Full name" error={e2.name} required><input className={`input ${e2.name ? 'input-error' : ''}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Work email" error={e2.email} required><input type="email" className={`input ${e2.email ? 'input-error' : ''}`} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role" hint={f.role === 'ADMIN' ? 'Full access, including products, taxes, discounts and users' : 'Customers, quotations, subscriptions, invoices and payments'}>
          <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="STAFF">Internal staff</option><option value="ADMIN">Admin</option></select>
        </Field>
        <Field label="Temporary password" error={e2.password} required>
          <input type="text" className={`input ${e2.password ? 'input-error' : ''}`} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
          <ul className="grid grid-cols-2 gap-1 mt-2">{passwordChecks(f.password).map((c) => <li key={c.text} className={`text-[12px] ${c.ok ? 'text-ok' : 'text-muted'}`}>{c.ok ? '✓' : '•'} {c.text}</li>)}</ul>
        </Field>
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const { exec } = useAction();
  const { data } = useQuery(() => api.users(), []);
  if (!data) return <Loading />;
  const groups = [['ADMIN', 'Admins'], ['STAFF', 'Internal staff'], ['CUSTOMER', 'Customer portal users']];
  return (
    <>
      <PageHeader title="Users & roles" subtitle="Only admins can add staff. Customers sign up themselves and see only their own data."
        actions={<button className="btn-primary" onClick={() => setAdding(true)}><UserPlus size={15} />Add staff</button>} />
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        {[['Admin', 'Everything: catalog, taxes, discounts, users, billing'], ['Staff', 'Day-to-day: customers, quotes, subscriptions, invoices, payments'], ['Customer', 'Own subscriptions and invoices through the portal']].map(([r, d]) => (
          <div key={r} className="card p-4"><Status value={r.toUpperCase()} /><p className="text-[13px] text-muted mt-2">{d}</p></div>
        ))}
      </div>
      {groups.map(([role, label]) => {
        const rows = data.filter((u) => u.role === role);
        return (
          <div key={role} className="mb-5">
            <h2 className="micro mb-2">{label} · {rows.length}</h2>
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
                <tbody>{rows.map((u) => (
                  <tr key={u.id}>
                    <td><div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-full bg-plum text-white text-[11px] font-semibold flex items-center justify-center">{initials(u.name)}</span><span className="font-medium">{u.name}</span>{u.id === user.id && <Badge tone="plum">You</Badge>}</div></td>
                    <td>{u.email}</td><td><Status value={u.role} /></td>
                    <td>{u.active ? <Badge tone="green">Active</Badge> : <Badge>Disabled</Badge>}</td>
                    <td className="r">{u.id !== user.id && <button className="btn-secondary btn-sm" onClick={() => exec(() => api.toggleUser(u.id), u.active ? 'User disabled' : 'User enabled')}>{u.active ? 'Disable' : 'Enable'}</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        );
      })}
      {adding && <AddStaffModal onClose={() => setAdding(false)} />}
    </>
  );
}
