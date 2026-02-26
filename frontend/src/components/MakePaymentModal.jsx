import { useState } from 'react';
import { X, DollarSign, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext';

const formatMoney = (amount) => parseFloat(amount || 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });

export default function MakePaymentModal({ loan, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { showToast } = useToast();

  const totalClearance = parseFloat(loan.remaining_balance || 0) + parseFloat(loan.current_interest_due || 0) + parseFloat(loan.accumulated_late_fees || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const paymentAmount = parseFloat(amount);
    if (paymentAmount > totalClearance) { setError(`Maximum payment is ${formatMoney(totalClearance)} RWF`); return; }
    
    setLoading(true); setError(null);
    try {
      await api.createPayment(loan.id, { amount: paymentAmount });
      showToast(`Payment of ${formatMoney(paymentAmount)} RWF recorded!`);
      onSuccess();
    } catch (err) { setError(err.message); } 
    finally { setLoading(false); }
  };

  const getPaymentBreakdown = () => {
    if (!amount || parseFloat(amount) <= 0) return null;
    let remaining = parseFloat(amount);
    
    const lateFeesDue = parseFloat(loan.accumulated_late_fees || 0);
    const lateFeesPayment = Math.min(remaining, lateFeesDue);
    remaining -= lateFeesPayment;

    const interestDue = parseFloat(loan.current_interest_due || 0);
    const interestPayment = Math.min(remaining, interestDue);
    remaining -= interestPayment;

    return { lateFees: lateFeesPayment, interest: interestPayment, principal: remaining };
  };

  const breakdown = getPaymentBreakdown();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-6">
          <div className="flex gap-3"><div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center"><DollarSign className="w-5 h-5 text-white" /></div><div><h2 className="text-xl font-bold text-slate-100">Make Payment</h2><p className="text-slate-400 text-sm">Loan #{loan.id}</p></div></div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="w-6 h-6" /></button>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-slate-400 text-xs mb-1">Principal</p><p className="text-slate-100 font-semibold">{formatMoney(loan.remaining_balance)} RWF</p></div>
            <div><p className="text-slate-400 text-xs mb-1">Interest</p><p className="text-amber-400 font-semibold">{formatMoney(loan.current_interest_due)} RWF</p></div>
            <div><p className="text-slate-400 text-xs mb-1">Fees</p><p className="text-red-400 font-semibold">{formatMoney(loan.accumulated_late_fees)} RWF</p></div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between"><p className="text-slate-300 font-medium">Total to Clear</p><p className="text-xl font-bold text-emerald-400">{formatMoney(totalClearance)} RWF</p></div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 text-red-300 rounded-lg text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Amount (RWF) *</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input text-xl font-semibold" placeholder="0" min="0" step="0.01" max={totalClearance} required />
            <div className="flex justify-between mt-2"><p className="text-xs text-slate-500">Scheduled: {formatMoney(loan.monthly_payment)} RWF</p><button type="button" onClick={() => setAmount(totalClearance.toString())} className="text-xs text-indigo-400">Pay in Full</button></div>
          </div>

          {breakdown && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4 space-y-3">
              <div className="flex gap-2 mb-3"><AlertCircle className="w-5 h-5 text-indigo-400" /><div><p className="text-indigo-300 text-sm font-medium">Payment Distribution</p><p className="text-indigo-300/70 text-xs">Waterfall logic</p></div></div>
              {breakdown.lateFees > 0 && <div className="flex justify-between"><span className="text-slate-400 text-sm">Late Fees</span><span className="text-red-400 font-semibold">{formatMoney(breakdown.lateFees)} RWF</span></div>}
              {breakdown.interest > 0 && <div className="flex justify-between"><span className="text-slate-400 text-sm">Interest</span><span className="text-amber-400 font-semibold">{formatMoney(breakdown.interest)} RWF</span></div>}
              {breakdown.principal > 0 && <div className="flex justify-between"><span className="text-slate-400 text-sm">Principal</span><span className="text-emerald-400 font-semibold">{formatMoney(breakdown.principal)} RWF</span></div>}
            </div>
          )}

          <div className="flex gap-3 pt-4"><button type="submit" disabled={loading || !amount} className="btn btn-success flex-1">{loading ? <Loader2 className="animate-spin mx-auto" size={18}/> : 'Record Payment'}</button><button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button></div>
        </form>
      </div>
    </div>
  );
}