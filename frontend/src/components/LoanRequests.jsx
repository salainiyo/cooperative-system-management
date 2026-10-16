import { useState, useEffect } from 'react';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { formatMoney } from '../utils/format';


const STATUS_STYLES = {
  pending: 'bg-amber-500/10 text-amber-400',
  approved: 'bg-emerald-500/10 text-emerald-400',
  rejected: 'bg-red-500/10 text-red-400',
};

export function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[status] || 'bg-slate-500/10 text-slate-400'}`}>
      {status}
    </span>
  );
}

export default function LoanRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getMyLoanRequests()
      .then(setRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-64 bg-slate-800 rounded-lg animate-pulse"></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">My Loan Requests</h1>
        <p className="text-slate-400">Track the status of your applications</p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {requests.length === 0 && !error ? (
        <div className="text-center py-16 bg-slate-900 rounded-2xl border border-slate-800">
          <ClipboardList className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">You haven't submitted any loan requests yet.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Monthly</th>
                  <th className="px-4 py-3 font-medium">Purpose</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Office note</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-300">{new Date(r.requested_at).toLocaleDateString('en-RW')}</td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{formatMoney(r.amount)} RWF</td>
                    <td className="px-4 py-3 text-slate-300">{formatMoney(r.monthly_payment)} RWF</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{r.purpose || '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-slate-400 max-w-[200px] truncate">{r.decision_note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
