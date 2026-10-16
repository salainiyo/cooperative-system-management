import { useState, useEffect } from 'react';
import { Wallet, PiggyBank, HandCoins, CalendarClock, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatMoney } from '../utils/format';


export default function MemberAccount() {
  const [account, setAccount] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [loans, setLoans] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [acc, elig, loanData] = await Promise.all([
        api.getPortalAccount(),
        api.getLoanEligibility(),
        api.getPortalLoans(),
      ]);
      setAccount(acc);
      setEligibility(elig);
      setLoans(loanData);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-slate-400">Failed to load your account: {error}</p>
          <button onClick={load} className="btn btn-primary mt-4">Retry</button>
        </div>
      </div>
    );
  }

  const activeLoan = loans?.active_loans?.[0] || null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">
          Hello, {account.first_name}
        </h1>
        <p className="text-slate-400">Your cooperative account at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="metric-card">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg mb-3">
            <PiggyBank className="w-6 h-6 text-white" />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Total Savings</p>
          <p className="text-2xl font-bold text-slate-100">{formatMoney(account.total_savings)} RWF</p>
        </div>

        <div className="metric-card">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg mb-3">
            <HandCoins className="w-6 h-6 text-white" />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Your Allowed Loan</p>
          <p className="text-2xl font-bold text-slate-100">
            {formatMoney(eligibility?.max_loan_allowed)} RWF
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {eligibility?.can_request
              ? 'You can request a loan now'
              : eligibility?.reason || ''}
          </p>
        </div>

        <div className="metric-card">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg mb-3">
            <CalendarClock className="w-6 h-6 text-white" />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Active Loans</p>
          <p className="text-2xl font-bold text-slate-100">{loans?.active_loans?.length || 0}</p>
        </div>
      </div>

      {activeLoan && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-amber-400" />
            Active Loan Progress
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Remaining balance</span>
              <span className="font-semibold text-slate-200">{formatMoney(activeLoan.remaining_balance)} RWF</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Monthly target</span>
              <span className="font-semibold text-slate-200">{formatMoney(activeLoan.monthly_payment)} RWF</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Next due date</span>
              <span className="font-semibold text-slate-200">
                {activeLoan.next_due_date ? new Date(activeLoan.next_due_date).toLocaleDateString('en-RW') : '—'}
              </span>
            </div>
            <div className="pt-3 border-t border-slate-700 flex justify-between">
              <span className="text-slate-300 font-medium">Interest due</span>
              <span className="font-bold text-amber-400">{formatMoney(activeLoan.current_interest_due)} RWF</span>
            </div>
          </div>
        </div>
      )}

      {!activeLoan && eligibility?.can_request && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-emerald-500/30 rounded-2xl p-6 text-center">
          <p className="text-slate-300 mb-4">You're eligible for a loan of up to {formatMoney(eligibility.max_loan_allowed)} RWF.</p>
          <Link to="/request-loan" className="btn btn-primary inline-flex">Request a Loan</Link>
        </div>
      )}
    </div>
  );
}
