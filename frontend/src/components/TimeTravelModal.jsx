import { useState, useMemo } from 'react';
import { Calendar, FastForward, Play, RotateCcw, AlertCircle, CheckCircle2, Clock, Zap, ArrowRight } from 'lucide-react';
import { Modal } from './ui';
import { api } from '../data/api';
import { useQuery, useAction, useToast } from '../lib/hooks';
import { fmtDate, inr } from '../lib/format';
import { addDays, todayIST } from '../lib/dates';

export function TimeTravelModal({ open, onClose }) {
  const { data, refetch } = useQuery(() => api.billingRuns(), []);
  const { data: subData } = useQuery(() => api.subscriptions({}), []);
  const { exec, busy } = useAction();
  const toast = useToast();

  const realToday = todayIST();
  const currentSimulated = data?.today || realToday;
  const isTimeShifted = Boolean(data?.clock);

  const [targetDate, setTargetDate] = useState(() => addDays(currentSimulated, 30));

  // Compute what will happen if we move to targetDate
  const projection = useMemo(() => {
    if (!subData?.rows) return { dueCount: 0, dueValue: 0, expiringCount: 0 };
    const rows = subData.rows;
    const dueSubs = rows.filter(
      (s) => s.state === 'ACTIVE' && s.nextBillingDate && s.nextBillingDate <= targetDate
    );
    const expiring = rows.filter(
      (s) => ['ACTIVE', 'PAUSED'].includes(s.state) && s.expiryDate && s.expiryDate <= targetDate
    );
    const dueValue = dueSubs.reduce((acc, s) => acc + (s.mrr || 0), 0);
    return {
      dueCount: dueSubs.length,
      dueValue,
      expiringCount: expiring.length,
    };
  }, [subData, targetDate]);

  const setJump = (days) => {
    setTargetDate(addDays(currentSimulated, days));
  };

  const handleSetClockOnly = async () => {
    await exec(() => api.setClock(targetDate), `Simulated date moved to ${fmtDate(targetDate)}`);
    if (refetch) refetch();
    onClose();
  };

  const handleFastForwardAndBill = async () => {
    // 1. Move clock
    await api.setClock(targetDate);
    // 2. Run billing
    const res = await exec(() => api.runBilling(targetDate));
    if (res.ok) {
      toast.success(`Billing run executed! Created ${res.result.count || 0} invoices.`);
      if (refetch) refetch();
      onClose();
    }
  };

  const handleReset = async () => {
    await exec(() => api.setClock(null), 'Simulation clock reset to real today');
    if (refetch) refetch();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Time Travel Sandbox & Billing Engine">
      <div className="space-y-5">
        {/* Current status bar */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-line bg-canvas text-[13px]">
          <div className="flex items-center gap-2">
            <Clock size={16} className={isTimeShifted ? 'text-gold' : 'text-plum'} />
            <div>
              <span className="text-muted">Current System Clock: </span>
              <span className="font-semibold text-charcoal">{fmtDate(currentSimulated)}</span>
              {isTimeShifted && <span className="ml-2 text-[11px] bg-gold/15 text-[#7a5200] font-medium px-2 py-0.5 rounded">Simulated</span>}
            </div>
          </div>
          {isTimeShifted && (
            <button
              onClick={handleReset}
              disabled={busy}
              className="text-plum hover:underline flex items-center gap-1 text-[12px] font-medium"
            >
              <RotateCcw size={12} /> Reset to Today
            </button>
          )}
        </div>

        {/* Quick jump pills */}
        <div>
          <label className="text-[12px] font-medium text-charcoal mb-1.5 block">Fast-Forward Horizon</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: '+7 Days', days: 7, desc: 'Weekly Batch' },
              { label: '+30 Days', days: 30, desc: 'Next Billing Day' },
              { label: '+60 Days', days: 60, desc: 'Mid-Quarter' },
              { label: '+90 Days', days: 90, desc: 'Quarter-End' },
            ].map((j) => (
              <button
                key={j.days}
                type="button"
                onClick={() => setJump(j.days)}
                className={`p-2 rounded-lg border text-left transition-all ${
                  targetDate === addDays(currentSimulated, j.days)
                    ? 'border-plum bg-plum-subtle text-plum font-semibold'
                    : 'border-line hover:bg-canvas text-charcoal'
                }`}
              >
                <div className="text-[13px]">{j.label}</div>
                <div className="text-[10px] text-muted">{j.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Target Date Picker */}
        <div className="flex items-center gap-3">
          <label className="text-[13px] font-medium text-charcoal whitespace-nowrap">Target Date:</label>
          <input
            type="date"
            className="input h-9 text-[13px]"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>

        {/* Projection Box */}
        <div className="bg-[#FAF8FB] border border-[#E9DFE7] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-plum">
            <Zap size={15} />
            <span>Projected Impact on {fmtDate(targetDate)}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white p-2.5 rounded-lg border border-line">
              <div className="text-[20px] font-semibold text-charcoal num">{projection.dueCount}</div>
              <div className="text-[11px] text-muted">Subscriptions Due</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-line">
              <div className="text-[20px] font-semibold text-ok num">{inr(projection.dueValue)}</div>
              <div className="text-[11px] text-muted">Est. Billable Volume</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-line">
              <div className="text-[20px] font-semibold text-warn num">{projection.expiringCount}</div>
              <div className="text-[11px] text-muted">Expiring / Renewals</div>
            </div>
          </div>
          <p className="text-[11px] text-muted leading-relaxed">
            The automated billing engine will create numbered tax invoices, calculate CGST/SGST/IGST by state rules, apply active discounts, and advance each subscription’s next billing date without duplicates.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-secondary text-charcoal"
            onClick={handleSetClockOnly}
            disabled={busy}
          >
            <FastForward size={14} /> Fast-Forward Clock Only
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleFastForwardAndBill}
            disabled={busy}
          >
            <Play size={14} /> Fast-Forward & Run Billing
          </button>
        </div>
      </div>
    </Modal>
  );
}

