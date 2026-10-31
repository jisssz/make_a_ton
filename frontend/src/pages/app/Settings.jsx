import { useState } from 'react';
import { Database, RotateCcw, Gauge, Building2 } from 'lucide-react';
import { PageHeader, Card, KeyValue, Modal } from '../../components/ui';
import { api, isDemoMode } from '../../data/api';
import { useAction, useQuery } from '../../lib/hooks';

export default function SettingsPage() {
  const { exec, busy } = useAction();
  const [resetting, setResetting] = useState(false);
  const { data: lk } = useQuery(() => api.lookups(), []);
  const c = lk?.company;
  return (
    <>
      <PageHeader title="Settings" subtitle="Company details and demo tools." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card title={<span className="flex items-center gap-2"><Building2 size={16} />Company</span>}>
          {c && <KeyValue items={[['Legal name', c.name], ['GSTIN', c.gstin], ['City', c.city], ['State (for GST split)', c.state], ['Currency', 'INR (₹)'], ['Time zone', 'Asia/Kolkata (IST)']]} />}
        </Card>
        {isDemoMode && (
          <Card title={<span className="flex items-center gap-2"><Gauge size={16} />Performance test</span>}>
            <p className="text-[13px] text-muted mb-3">Adds thousands of subscriptions with a full year of invoices and payments, so you can check every page still loads in under 2 seconds. Watch the “Loaded in … ms” badge on the Overview.</p>
            <div className="flex flex-wrap gap-2">
              {[1000, 5000].map((n) => (
                <button key={n} className="btn-primary" disabled={busy} onClick={() => exec(() => api.generateBulk(n), (ms) => `${n.toLocaleString('en-IN')} subscriptions generated in ${ms} ms`)}>
                  <Database size={15} />Add {n.toLocaleString('en-IN')} subscriptions
                </button>
              ))}
            </div>
          </Card>
        )}
        {isDemoMode && (
          <Card title={<span className="flex items-center gap-2"><RotateCcw size={16} />Demo data</span>}>
            <p className="text-[13px] text-muted mb-3">This build runs on built-in sample data so it works without the server. Reset to start a fresh demo.</p>
            <button className="btn-danger" onClick={() => setResetting(true)}><RotateCcw size={15} />Reset demo data</button>
          </Card>
        )}
      </div>
      {resetting && (
        <Modal open onClose={() => setResetting(false)} title="Reset demo data?"
          footer={<><button className="btn-secondary" onClick={() => setResetting(false)}>Cancel</button><button className="btn-primary" onClick={async () => { await exec(() => api.resetDemo(), 'Demo data reset'); setResetting(false); }}>Reset</button></>}>
          <p className="text-[14px]">All changes made in this browser will be replaced with fresh sample data.</p>
        </Modal>
      )}
    </>
  );
}
