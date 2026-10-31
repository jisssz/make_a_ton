import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Send, Printer, CreditCard, XCircle } from 'lucide-react';
import { PageHeader, Card, Loading, Status, Empty, Modal, Logo } from '../../components/ui';
import { RecordPaymentModal } from '../../components/shared';
import { TaxBox } from './SubscriptionDetail';
import { api } from '../../data/api';
import { useQuery, useAction } from '../../lib/hooks';
import { inr, fmtDate } from '../../lib/format';

export default function InvoiceDetail({ portal }) {
  const { id } = useParams();
  const { data, error } = useQuery(() => api.invoice(id), [id]);
  const { exec, busy } = useAction();
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  if (error) return <Empty title="Invoice not found" action={<Link to={portal ? '/portal/invoices' : '/app/invoices'} className="btn-secondary">Back</Link>} />;
  if (!data) return <Loading rows={10} />;
  const { invoice: inv, customer, company, subscription, payments } = data;
  const open = ['CONFIRMED', 'PARTIAL'].includes(inv.state);
  const title = inv.number || `Draft invoice #${inv.id}`;

  return (
    <>
      <div className="no-print">
        <PageHeader title={<span className="flex items-center gap-3">{title}<Status value={inv.state} overdue={inv.overdue} /></span>}
          subtitle={`${customer.name} · ${fmtDate(inv.periodStart)} – ${fmtDate(inv.periodEnd)}`}
          crumbs={portal ? [{ label: 'Invoices', to: '/portal/invoices' }, { label: title }] : [{ label: 'Invoices', to: '/app/invoices' }, { label: title }]}
          actions={<>
            {!portal && inv.state === 'DRAFT' && <button className="btn-primary" disabled={busy} onClick={() => exec(() => api.confirmInvoices([inv.id]), 'Invoice confirmed and numbered')}><Check size={14} />Confirm</button>}
            {!portal && ['DRAFT', 'CONFIRMED', 'PARTIAL'].includes(inv.state) && <button className="btn-secondary" disabled={busy} onClick={() => exec(() => api.sendInvoice(inv.id), (to) => `Invoice emailed to ${to}`)}><Send size={14} />Send</button>}
            {!portal && open && <button className="btn-teal" onClick={() => setPaying(true)}><CreditCard size={14} />Record payment</button>}
            <button className="btn-secondary" onClick={() => window.print()}><Printer size={14} />Print / PDF</button>
            {!portal && ['DRAFT', 'CONFIRMED'].includes(inv.state) && inv.amountPaid === 0 && <button className="btn-danger" onClick={() => setCancelling(true)}><XCircle size={14} />Cancel</button>}
          </>} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <article className="card print-area lg:col-span-2 p-6 sm:p-8">
          <header className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-line">
            <div>
              <Logo size="sm" to={portal ? '/portal' : '/app'} />
              <div className="mt-3 text-[13px] leading-5">
                <div className="font-semibold">{company.name}</div>
                <div className="text-muted">{company.city}, {company.state}</div>
                <div className="text-muted">GSTIN {company.gstin}</div>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-[22px] font-semibold tracking-tight">Tax invoice</div>
              <div className="num text-[14px] mt-1">{inv.number || 'DRAFT'}</div>
              <dl className="mt-3 text-[13px] grid grid-cols-2 sm:justify-end gap-x-4 gap-y-0.5">
                <dt className="text-muted">Invoice date</dt><dd className="num">{fmtDate(inv.invoiceDate)}</dd>
                <dt className="text-muted">Due date</dt><dd className={`num ${inv.overdue ? 'text-bad font-medium' : ''}`}>{fmtDate(inv.dueDate)}</dd>
                <dt className="text-muted">Subscription</dt><dd>{subscription?.number}</dd>
              </dl>
            </div>
          </header>
          <section className="grid sm:grid-cols-2 gap-4 py-5 text-[13px]">
            <div>
              <div className="micro mb-1">Bill to</div>
              <div className="font-semibold">{customer.name}</div>
              <div className="text-muted">{customer.email}</div>
              <div className="text-muted">{[customer.city, customer.state].filter(Boolean).join(', ')}</div>
              {customer.gstin && <div className="text-muted">GSTIN {customer.gstin}</div>}
            </div>
            <div className="sm:text-right">
              <div className="micro mb-1">Service period</div>
              <div className="num">{fmtDate(inv.periodStart)} – {fmtDate(inv.periodEnd)}</div>
              <div className="micro mt-2 mb-1">Place of supply</div>
              <div>{customer.state}</div>
            </div>
          </section>
          <div className="overflow-x-auto">
            <table className="tbl border-y border-line">
              <thead><tr><th>Description</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Discount</th><th className="r">Taxable</th><th className="r">GST</th><th className="r">Amount</th></tr></thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="font-medium">{l.description}</td>
                    <td className="r num">{l.qty}</td>
                    <td className="r num">{inr(l.unitPrice)}</td>
                    <td className="r num">{l.discount ? `− ${inr(l.discount)}` : '—'}</td>
                    <td className="r num">{inr(l.taxable)}</td>
                    <td className="r num text-[12px]">{l.taxRate ? `${l.taxRate}% · ${inr(l.tax)}` : '—'}</td>
                    <td className="r num font-medium">{inr(l.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-5">
            <div className="w-full sm:w-auto">
              <TaxBox preview={inv} customer={customer} company={company} />
              {inv.amountPaid > 0 && <>
                <div className="flex justify-between text-[13px] text-ok mt-2"><span>Paid</span><span className="num">− {inr(inv.amountPaid)}</span></div>
                <div className="flex justify-between text-[14px] font-semibold mt-1"><span>Balance due</span><span className="num">{inr(inv.balance)}</span></div>
              </>}
            </div>
          </div>
          <footer className="mt-8 pt-4 border-t border-line text-[12px] text-muted">
            Pay by UPI or bank transfer quoting {inv.number || 'the invoice number'}. Thank you for your business.
          </footer>
        </article>

        <div className="space-y-4 no-print">
          <Card title="Payment status">
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-muted">Total</span><span className="num">{inr(inv.total)}</span></div>
              <div className="flex justify-between"><span className="text-muted">Paid</span><span className="num text-ok">{inr(inv.amountPaid)}</span></div>
              <div className="flex justify-between font-semibold text-[15px]"><span>Balance</span><span className={`num ${inv.balance && open ? 'text-warn' : ''}`}>{inr(open ? inv.balance : 0)}</span></div>
              <div className="h-2 bg-line rounded overflow-hidden"><div className="h-full bg-ok" style={{ width: `${inv.total ? Math.min(100, (inv.amountPaid / inv.total) * 100) : 0}%` }} /></div>
              {inv.overdue && <div className="text-bad text-[12px] font-medium">{inv.daysOverdue} days overdue</div>}
              {inv.sentAt && <div className="text-[12px] text-muted">Sent to customer</div>}
            </div>
          </Card>
          <Card title={`Payments (${payments.length})`} pad={false}>
            {payments.length === 0 ? <div className="p-4 text-[13px] text-muted">No payments recorded yet.</div> : (
              <ul>{payments.map((p) => (
                <li key={p.id} className="px-4 py-2.5 border-b border-line last:border-0 flex justify-between text-[13px]">
                  <div><div className="font-medium">{p.method}</div><div className="text-[12px] text-muted">{fmtDate(p.paidOn)}{p.note && ` · ${p.note}`}</div></div>
                  <div className="num font-medium">{inr(p.amount)}</div>
                </li>
              ))}</ul>
            )}
          </Card>
        </div>
      </div>

      {paying && <RecordPaymentModal invoice={inv} onClose={() => setPaying(false)} />}
      {cancelling && (
        <Modal open onClose={() => setCancelling(false)} title="Cancel this invoice?"
          footer={<><button className="btn-secondary" onClick={() => setCancelling(false)}>Keep it</button><button className="btn-primary bg-bad hover:bg-bad" onClick={async () => { await exec(() => api.cancelInvoice(inv.id), 'Invoice cancelled'); setCancelling(false); }}>Cancel invoice</button></>}>
          <p className="text-[14px]">The invoice is kept for the audit trail but marked Cancelled. Any discount usage it counted is released.</p>
        </Modal>
      )}
    </>
  );
}
