import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '../api';
import { StatusBadge } from './LoanRequests';
import { formatMoney } from '../utils/format';
import Modal from './ui/Modal';


const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: null, label: 'All' },
];

export default function LoanRequestsQueue() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionTarget, setActionTarget] = useState(null); // { request, action: 'approve'|'reject' }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async (statusFilter = filter) => {
    setLoading(true);
    try {
      const data = await api.getLoanRequests(statusFilter);
      setRequests(data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleAction = async () => {
    if (!actionTarget) return;
    if (actionTarget.action === 'reject' && !note.trim()) {
      setError('Please provide a reason when rejecting a request.');
      return;
    }
    setBusy(true);
    try {
      if (actionTarget.action === 'approve') {
        await api.approveLoanRequest(actionTarget.request.id, note.trim());
      } else {
        await api.rejectLoanRequest(actionTarget.request.id, note.trim());
      }
      setActionTarget(null);
      setNote('');
      await load(filter);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Loan Requests</h1>
        <p className="text-slate-400">Review and decide on member applications</p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-64 bg-slate-800 rounded-lg animate-pulse"></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 rounded-2xl border border-slate-800">
          <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No {filter || ''} loan requests.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Monthly</th>
                  <th className="px-4 py-3 font-medium">Purpose</th>
                  <th className="px-4 py-3 font-medium">Requested</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <Link to={`/member/${r.member_id}`} className="text-indigo-400 hover:text-indigo-300 font-medium">
                        {r.member_name || `Member #${r.member_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{formatMoney(r.amount)} RWF</td>
                    <td className="px-4 py-3 text-slate-300">{formatMoney(r.monthly_payment)} RWF</td>
                    <td className="px-4 py-3 text-slate-400 max-w-[180px] truncate">{r.purpose || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(r.requested_at).toLocaleDateString('en-RW')}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      {r.status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setActionTarget({ request: r, action: 'approve' }); setNote(''); setError(null); }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => { setActionTarget({ request: r, action: 'reject' }); setNote(''); setError(null); }}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">{r.decision_note || '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Decision modal */}
      {actionTarget && (
        <Modal onClose={() => !busy && setActionTarget(null)}>
            <div className="flex items-center gap-3 mb-4">
              {actionTarget.action === 'approve' ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              ) : (
                <XCircle className="w-8 h-8 text-red-400" />
              )}
              <div>
                <h2 className="text-xl font-bold text-slate-100">
                  {actionTarget.action === 'approve' ? 'Approve' : 'Reject'} request?
                </h2>
                <p className="text-slate-400 text-sm">
                  {actionTarget.request.member_name}: {formatMoney(actionTarget.request.amount)} RWF
                </p>
              </div>
            </div>

            {actionTarget.action === 'approve' && (
              <p className="text-slate-400 text-sm mb-4">
                Approving will create an active loan and email the member.
              </p>
            )}

            <label className="block text-sm font-medium text-slate-300 mb-2">
              Note {actionTarget.action === 'reject' ? '(required)' : '(optional)'}
            </label>
            <textarea
              className="input min-h-[80px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={actionTarget.action === 'approve' ? 'Any conditions or comments...' : 'Reason for rejection...'}
            />

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAction}
                disabled={busy}
                className={`btn flex-1 ${actionTarget.action === 'approve' ? 'btn-primary' : 'btn-danger'}`}
              >
                {busy ? <Loader2 size={18} className="animate-spin mx-auto" /> : `Confirm ${actionTarget.action}`}
              </button>
              <button onClick={() => setActionTarget(null)} disabled={busy} className="btn btn-ghost">
                Cancel
              </button>
            </div>
          </Modal>
      )}
    </div>
  );
}
