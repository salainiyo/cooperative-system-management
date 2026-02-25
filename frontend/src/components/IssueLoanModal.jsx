import { useState, useEffect } from 'react';
import { X, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api';

const formatMoney = (amount) => parseFloat(amount || 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });

export default function IssueLoanModal({ member, onClose, onSuccess }) {
  // 1. Removed interest_rate from editable state
  const [formData, setFormData] = useState({
    amount: '',
    monthly_payment: '',
  });
  
  const FIXED_INTEREST_RATE = 1.5; // Fixed cooperative rate

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  const maxLoanAllowed = parseFloat(member.total_savings || 0) * 2;

  useEffect(() => {
    const newWarnings = [];
    if (parseFloat(member.total_savings || 0) <= 0) {
      newWarnings.push('Member has no savings balance');
    }
    if (member.active_loans && member.active_loans.length >= 1) {
      newWarnings.push('Member already has an active loan');
    }

    const loanAmount = parseFloat(formData.amount || 0);
    if (loanAmount > maxLoanAllowed) {
      newWarnings.push(`Loan exceeds maximum allowed: ${formatMoney(maxLoanAllowed)} RWF`);
    }

    const monthlyPayment = parseFloat(formData.monthly_payment || 0);
    if (monthlyPayment > loanAmount && loanAmount > 0) {
      newWarnings.push('Monthly payment cannot exceed loan amount');
    }
    setWarnings(newWarnings);
  }, [formData, member, maxLoanAllowed]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (warnings.length > 0) {
      setError('Please resolve all warnings before submitting');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 2. Hardcode the 1.5% rate directly into the API payload
      const loanData = {
        amount: parseFloat(formData.amount),
        interest_rate: FIXED_INTEREST_RATE, 
        monthly_payment: parseFloat(formData.monthly_payment),
      };
      
      await api.createLoan(member.id, loanData);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const estimatedMonths = formData.amount && formData.monthly_payment
    ? Math.ceil(parseFloat(formData.amount) / parseFloat(formData.monthly_payment))
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Issue New Loan</h2>
              <p className="text-slate-400 text-sm">For {member.first_name} {member.last_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="w-6 h-6" /></button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400 mb-1">Total Savings</p>
              <p className="text-emerald-400 font-semibold">{formatMoney(member.total_savings)} RWF</p>
            </div>
            <div>
              <p className="text-slate-400 mb-1">Maximum Loan</p>
              <p className="text-indigo-400 font-semibold">{formatMoney(maxLoanAllowed)} RWF</p>
            </div>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mb-4 space-y-2">
            {warnings.map((warning, index) => (
              <div key={index} className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-amber-300 text-sm">{warning}</p>
              </div>
            ))}
          </div>
        )}

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Loan Amount (RWF) *</label>
            <input type="number" name="amount" value={formData.amount} onChange={handleChange} className="input text-xl font-semibold" placeholder="0" min="0" step="0.01" required />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {/* 3. Changed to a disabled, read-only input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Interest Rate *</label>
              <input 
                type="text" 
                value={`${FIXED_INTEREST_RATE}% (Fixed Monthly)`} 
                disabled 
                className="input bg-slate-900/50 text-slate-500 border-slate-800 cursor-not-allowed" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Monthly Payment (RWF) *</label>
              <input type="number" name="monthly_payment" value={formData.monthly_payment} onChange={handleChange} className="input" placeholder="0" min="0" step="0.01" required />
            </div>
          </div>

          {formData.amount && formData.monthly_payment && estimatedMonths > 0 && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
              <p className="text-indigo-300 text-sm mb-3">Loan Summary</p>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-slate-400 text-xs mb-1">Loan Amount</p><p className="text-slate-100 font-semibold">{formatMoney(formData.amount)} RWF</p></div>
                <div><p className="text-slate-400 text-xs mb-1">Monthly Payment</p><p className="text-slate-100 font-semibold">{formatMoney(formData.monthly_payment)} RWF</p></div>
                <div><p className="text-slate-400 text-xs mb-1">Estimated Duration</p><p className="text-indigo-400 font-semibold">~{estimatedMonths} months</p></div>
                <div><p className="text-slate-400 text-xs mb-1">Fixed Interest</p><p className="text-indigo-400 font-semibold">{FIXED_INTEREST_RATE}% / month</p></div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button type="submit" disabled={loading || warnings.length > 0} className="btn btn-primary flex-1">
              {loading ? <Loader2 size={18} className="animate-spin mx-auto"/> : 'Issue Loan'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}