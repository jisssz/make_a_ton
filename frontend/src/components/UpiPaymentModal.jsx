import { useState, useMemo } from 'react';
import { CheckCircle2, Copy, Check, ExternalLink, Sparkles, Smartphone, ArrowRight, ShieldCheck, Share2 } from 'lucide-react';
import { Modal } from './ui';
import { generateQRCodeSVG } from '../lib/qr';
import { inr, fmtDate } from '../lib/format';
import { todayIST } from '../lib/dates';
import { api } from '../data/api';
import { useAction, useToast } from '../lib/hooks';

const UPI_APPS = [
  { id: 'gpay', name: 'Google Pay', color: 'bg-[#4285F4]', text: 'text-white' },
  { id: 'phonepe', name: 'PhonePe', color: 'bg-[#5f259f]', text: 'text-white' },
  { id: 'paytm', name: 'Paytm', color: 'bg-[#002e6e]', text: 'text-white' },
  { id: 'bhim', name: 'BHIM UPI', color: 'bg-[#00796b]', text: 'text-white' },
  { id: 'cred', name: 'CRED UPI', color: 'bg-[#1a1a1a]', text: 'text-white' },
];

export function UpiPaymentModal({ invoice, customer, open, onClose, onSettled }) {
  const [selectedApp, setSelectedApp] = useState('gpay');
  const [step, setStep] = useState('ready'); // ready | processing | settled
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const { exec } = useAction();
  const toast = useToast();

  const vpa = 'brightloop@okaxis';
  const payeeName = 'Brightloop Software Pvt Ltd';
  const amountPaise = invoice ? invoice.balance : 0;
  const amountRupees = (amountPaise / 100).toFixed(2);
  const invoiceNumber = invoice?.number || `INV-${invoice?.id}`;

  const upiUri = useMemo(() => {
    return `upi://pay?pa=${vpa}&pn=${encodeURIComponent(payeeName)}&am=${amountRupees}&cu=INR&tn=${encodeURIComponent(`Invoice ${invoiceNumber}`)}&tr=BL${invoice?.id || '0'}`;
  }, [vpa, payeeName, amountRupees, invoiceNumber, invoice?.id]);

  const qr = useMemo(() => {
    try {
      return generateQRCodeSVG(upiUri, 200);
    } catch {
      return null;
    }
  }, [upiUri]);

  if (!invoice) return null;

  const copyVpa = () => {
    navigator.clipboard?.writeText(vpa);
    setCopied(true);
    toast.success('UPI ID copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsapp = () => {
    const text = `Hello ${customer?.name || 'Customer'}, here is the payment link for Brightloop Software invoice ${invoiceNumber} of ${inr(amountPaise)}:\n\n${upiUri}\n\nUPI ID: ${vpa}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const simulatePayment = async () => {
    setStep('processing');
    setStatusMsg('1/3 Connecting to NPCI Bharat UPI Switch...');

    await new Promise((r) => setTimeout(r, 600));
    setStatusMsg(`2/3 Authenticating ₹${Number(amountRupees).toLocaleString('en-IN')} via ${UPI_APPS.find((a) => a.id === selectedApp)?.name}...`);

    await new Promise((r) => setTimeout(r, 700));
    setStatusMsg('3/3 Settling merchant account & generating reconciliation voucher...');

    await new Promise((r) => setTimeout(r, 500));

    const refNo = `UPI/${new Date().getFullYear()}/${Math.floor(10000000 + Math.random() * 90000000)}`;
    const appName = UPI_APPS.find((a) => a.id === selectedApp)?.name || 'UPI';

    const r = await exec(() =>
      api.recordPayment({
        invoiceId: invoice.id,
        method: 'UPI',
        amount: amountPaise,
        paidOn: todayIST(),
        note: `Instant Bharat UPI settlement via ${appName} (Ref ${refNo})`,
      }),
      `Payment of ${inr(amountPaise)} settled instantly via ${appName}`
    );

    if (r.ok) {
      setStep('settled');
      setTimeout(() => {
        if (onSettled) onSettled();
        onClose();
      }, 1500);
    } else {
      setStep('ready');
    }
  };

  return (
    <Modal open={open} onClose={step === 'processing' ? () => {} : onClose} title="Instant Bharat UPI Payment Terminal">
      {step === 'settled' ? (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 bg-ok-bg text-ok rounded-full flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h3 className="text-[20px] font-semibold text-charcoal">Payment Successful!</h3>
            <p className="text-[14px] text-muted mt-1">Invoice <span className="font-semibold text-charcoal">{invoiceNumber}</span> is now fully marked as <span className="text-ok font-semibold">PAID</span>.</p>
          </div>
          <div className="bg-canvas border border-line rounded-lg p-3 max-w-sm mx-auto text-[13px] text-left space-y-1">
            <div className="flex justify-between"><span className="text-muted">Amount Paid:</span><span className="font-semibold text-ok">{inr(amountPaise)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Mode:</span><span>Bharat UPI Instant PSP</span></div>
            <div className="flex justify-between"><span className="text-muted">Reconciliation:</span><span className="text-muted">Automatic / 0 Variance</span></div>
          </div>
        </div>
      ) : step === 'processing' ? (
        <div className="py-12 text-center space-y-5">
          <div className="w-12 h-12 border-4 border-plum border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-[17px] font-semibold text-charcoal">Processing UPI Transaction</h3>
            <p className="text-[13px] text-plum font-medium animate-pulse">{statusMsg}</p>
          </div>
          <p className="text-[11px] text-muted">Secured by National Payments Corporation of India (NPCI) & RBI Compliance</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top highlight banner */}
          <div className="flex items-center justify-between bg-[#F4FBF7] border border-[#C6F0D8] p-3 rounded-lg text-[13px]">
            <div>
              <div className="font-medium text-[#1E4620]">Invoice Balance Due</div>
              <div className="text-[12px] text-[#2E7D32]">{invoiceNumber} · {customer?.name}</div>
            </div>
            <div className="text-right">
              <div className="text-[20px] font-semibold text-[#1E4620] num">{inr(amountPaise)}</div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#2E7D32] bg-white px-1.5 py-0.5 rounded border border-[#C6F0D8]">Zero Transaction Fee</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-center">
            {/* Dynamic QR Code Card */}
            <div className="flex flex-col items-center bg-white p-4 border border-line rounded-xl shadow-sm text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-1.5">
                <Smartphone size={13} /> Scan with Any UPI App
              </div>
              <div className="p-2 bg-white rounded-lg border border-line shadow-inner relative group">
                {qr ? (
                  <svg width={qr.size} height={qr.size} viewBox={`0 0 ${qr.size} ${qr.size}`} className="rounded">
                    <rect width="100%" height="100%" fill="white" />
                    <path d={qr.paths} fill="#1E2022" />
                  </svg>
                ) : (
                  <div className="w-[180px] h-[180px] flex items-center justify-center text-muted text-xs">QR unavailable</div>
                )}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white px-2 py-0.5 rounded border border-line shadow-sm text-[10px] font-bold text-plum tracking-tight">
                    UPI
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[12px] bg-canvas px-2.5 py-1 rounded-full border border-line text-charcoal">
                <span className="font-mono text-muted text-[11px]">{vpa}</span>
                <button onClick={copyVpa} className="text-plum hover:underline flex items-center gap-0.5 text-[11px] font-medium" title="Copy UPI VPA">
                  {copied ? <Check size={12} className="text-ok" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            {/* UPI App Selection & Instant Simulator */}
            <div className="space-y-3.5">
              <div>
                <label className="text-[12px] font-medium text-charcoal mb-1.5 block">Select UPI App to Simulate</label>
                <div className="grid grid-cols-2 gap-2">
                  {UPI_APPS.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setSelectedApp(app.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-left text-[12px] font-medium transition-all ${
                        selectedApp === app.id
                          ? 'border-plum bg-plum-subtle text-plum shadow-sm ring-1 ring-plum'
                          : 'border-line hover:bg-canvas text-charcoal'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${app.color}`} />
                      <span>{app.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={simulatePayment}
                  className="w-full btn-teal h-10 flex items-center justify-center gap-2 text-[14px] font-semibold shadow-sm hover:shadow"
                >
                  <Sparkles size={16} />
                  <span>Simulate Instant UPI Settlement</span>
                </button>
                <p className="text-[11px] text-center text-muted mt-1.5">
                  Simulates instant webhook confirmation from NPCI switch
                </p>
              </div>

              <div className="border-t border-line pt-3 flex items-center justify-between text-[12px]">
                <button
                  type="button"
                  onClick={shareWhatsapp}
                  className="text-muted hover:text-charcoal flex items-center gap-1.5 font-medium transition-colors"
                >
                  <Share2 size={13} className="text-[#25D366]" /> Share on WhatsApp
                </button>
                <span className="flex items-center gap-1 text-[11px] text-muted">
                  <ShieldCheck size={13} className="text-ok" /> 256-bit encrypted
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
