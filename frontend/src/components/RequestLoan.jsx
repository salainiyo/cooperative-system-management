import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../api';
import { formatMoney } from '../utils/format';


export default function RequestLoan() {
  const navigate = useNavigate();
  const [eligibility, setEligibility] = useState(null);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [amount, setAmount] = useState('');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [purpose, setPurpose] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api
      .getLoanEligibility()
      .then(setEligibility)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingEligibility(false));
  }, []);

  const maxLoan = parseFloat(eligibility?.max_loan_allowed || 0);
  const requested = parseFloat(amount || 0);
  const overLimit = requested > maxLoan && maxLoan > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (requested <= 0) {
      setError('Enter a valid loan amount.');
      return;
    }
    if (overLimit) {
      setError(`Your maximum allowed loan is ${formatMoney(maxLoan)} RWF.`);
      return;
    }
    if (parseFloat(monthlyPayment) <= 0 || parseFloat(monthlyPayment) > requested) {
      setError('Monthly payment must be positive and cannot exceed the loan amount.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createLoanRequest({
        amount: requested,
        monthly_payment: parseFloat(monthlyPayment),
        purpose: purpose || null,
      });
      setSuccess(true);
      setTimeout(() => navigate('/my-requests'), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingEligibility) {
    return <div className="h-64 bg-slate-800 rounded-lg animate-pulse"></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Request a Loan</h1>
        <p className="text-slate-400">The cooperative office will review your request</p>
      </div>

      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">Your eligibility</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-400">Total savings</p>
            <p className="text-xl font-bold text-slate-100">{formatMoney(eligibility?.total_savings)} RWF</p>
          </div>
          <div>
            <p className="text-slate-400">Maximum you can borrow</p>
            <p className="text-xl font-bold text-emerald-400">{formatMoney(eligibility?.max_loan_allowed)} RWF</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Your limit is {parseFloat(eligibility?.loan_savings_multiplier || 2)}× your savings
          {eligibility?.interest_rate ? ` at ${(parseFloat(eligibility.interest_rate) * 100).toFixed(1)}% interest per period` : ''}.
        </p>
      </div>

      {!eligibility?.can_request ? (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {eligibility?.reason || 'You are not eligible for a loan right now.'}
        </div>
      ) : success ? (
        <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-100 mb-1">Request submitted</h3>
          <p className="text-slate-400 text-sm">The office will review it shortly. Redirecting you...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Loan Amount (RWF)</label>
            <input
              type="number"
              min="1"
              step="100"
              className="input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Up to ${formatMoney(maxLoan)}`}
              required
            />
            {overLimit && (
              <p className="text-xs text-red-400 mt-1">Amount exceeds your limit of {formatMoney(maxLoan)} RWF.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Monthly Payment (RWF)</label>
            <input
              type="number"
              min="1"
              step="100"
              className="input"
              value={monthlyPayment}
              onChange={(e) => setMonthlyPayment(e.target.value)}
              placeholder="What you can pay each month"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Purpose (optional)</label>
            <input
              type="text"
              maxLength={255}
              className="input"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Farm supplies, small business..."
            />
          </div>

          <button type="submit" disabled={submitting} className="btn btn-primary gap-2">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <ClipboardList size={18} />}
            Submit request
          </button>
        </form>
      )}
    </div>
  );
}
