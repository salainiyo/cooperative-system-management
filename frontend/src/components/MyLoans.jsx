import { useState, useEffect } from 'react';
import { HandCoins, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../api';
import { formatMoney } from '../utils/format';


function LoanCard({ loan }) {
  const total = parseFloat(loan.amount || 0);
  const remaining = parseFloat(loan.remaining_balance || 0);
  const paidPct = total > 0 ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 0;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-100">Loan #{loan.id}</h3>
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            loan.status === 'active' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
          }`}
        >
          {loan.status === 'active' ? 'Active' : 'Paid'}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-400">Amount</span><span className="text-slate-200 font-medium">{formatMoney(loan.amount)} RWF</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Remaining</span><span className="text-slate-200 font-medium">{formatMoney(loan.remaining_balance)} RWF</span></div>
        <div className="flex justify-between"><span className="text-slate-400">Monthly payment</span><span className="text-slate-200 font-medium">{formatMoney(loan.monthly_payment)} RWF</span></div>
        {loan.status === 'active' && (
          <>
            <div className="flex justify-between"><span className="text-slate-400">Interest due</span><span className="text-amber-400 font-medium">{formatMoney(loan.current_interest_due)} RWF</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Next due date</span><span className="text-slate-200 font-medium">{loan.next_due_date ? new Date(loan.next_due_date).toLocaleDateString('en-RW') : '—'}</span></div>
          </>
        )}
      </div>
      <div className="mt-4">
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${paidPct}%` }}></div>
        </div>
        <p className="text-xs text-slate-500 mt-1">{paidPct.toFixed(0)}% of principal repaid</p>
      </div>
    </div>
  );
}

export default function MyLoans() {
  const [loans, setLoans] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getPortalLoans()
      .then(setLoans)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-64 bg-slate-800 rounded-lg animate-pulse"></div>;
  if (error) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="text-slate-400">{error}</p>
      </div>
    );
  }

  const active = loans.active_loans || [];
  const completed = loans.completed_loans || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">My Loans</h1>
        <p className="text-slate-400">Everything you've borrowed from the cooperative</p>
      </div>

      {active.length === 0 && completed.length === 0 && (
        <div className="text-center py-16 bg-slate-900 rounded-2xl border border-slate-800">
          <HandCoins className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">You have no loans yet.</p>
        </div>
      )}

      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Active</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {active.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Completed
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {completed.map((loan) => (
              <LoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
