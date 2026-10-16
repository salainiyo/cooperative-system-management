import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { HandCoins, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';
import { formatMoney } from '../utils/format';


const FILTERS = [
  { key: null, label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paid', label: 'Paid' },
];

export default function AllLoansPage() {
  const { showToast } = useToast();
  const [loans, setLoans] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = async (status = statusFilter, pageOffset = offset) => {
    setLoading(true);
    try {
      const data = await api.getLoanList({ status, offset: pageOffset, limit });
      setLoans(data.loans || []);
      setTotalCount(data.total_count || 0);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(statusFilter, 0);
    setOffset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.downloadCsv('loans');
      showToast('Loans CSV downloaded');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">All Loans</h1>
          <p className="text-slate-400">{totalCount} loan{totalCount === 1 ? '' : 's'} in the system</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn btn-ghost gap-2">
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export CSV
        </button>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setStatusFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f.key
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
      ) : loans.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 rounded-2xl border border-slate-800">
          <HandCoins className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No loans found.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Monthly</th>
                  <th className="px-4 py-3 font-medium">Remaining</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Payments</th>
                  <th className="px-4 py-3 font-medium">Approved</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id} className="border-b border-slate-800/50 hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-400">#{loan.id}</td>
                    <td className="px-4 py-3">
                      <Link to={`/member/${loan.member_id}`} className="text-indigo-400 hover:text-indigo-300 font-medium">
                        {loan.member_name || `Member #${loan.member_id}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-200 font-medium">{formatMoney(loan.amount)} RWF</td>
                    <td className="px-4 py-3 text-slate-300">{formatMoney(loan.monthly_payment)} RWF</td>
                    <td className="px-4 py-3 text-slate-200">{formatMoney(loan.remaining_balance)} RWF</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          loan.status === 'active' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}
                      >
                        {loan.status === 'active' ? 'Active' : 'Paid'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{loan.payments_count ?? 0}</td>
                    <td className="px-4 py-3 text-slate-400">
                      {loan.approved_at ? new Date(loan.approved_at).toLocaleDateString('en-RW') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Page {offset / limit + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { const next = Math.max(0, offset - limit); setOffset(next); load(statusFilter, next); }}
                disabled={offset === 0}
                className="btn btn-ghost btn-sm"
              >
                Previous
              </button>
              <button
                onClick={() => { const next = offset + limit; setOffset(next); load(statusFilter, next); }}
                disabled={offset + limit >= totalCount}
                className="btn btn-ghost btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
