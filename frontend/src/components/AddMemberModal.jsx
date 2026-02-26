import { useState } from 'react';
import { X, PiggyBank, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext'; // <-- Import Toast

const formatMoney = (amount) => parseFloat(amount || 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });

export default function AddSavingsModal({ memberId, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { showToast } = useToast(); // <-- Initialize Toast

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.createSavings(memberId, { amount: parseFloat(amount) });
      showToast(`Successfully deposited ${formatMoney(amount)} RWF!`); // <-- Trigger Toast
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <PiggyBank className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Add Savings</h2>
              <p className="text-slate-400 text-sm">Record a savings deposit</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Deposit Amount (RWF) *</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input text-xl font-semibold" placeholder="0" min="0" step="0.01" required />
            <p className="text-xs text-slate-500 mt-2">Enter the amount the member is depositing</p>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
              <p className="text-emerald-300 text-sm mb-1">New deposit</p>
              <p className="text-2xl font-bold text-emerald-400">{formatMoney(amount)} RWF</p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button type="submit" disabled={loading || !amount || parseFloat(amount) <= 0} className="btn btn-success flex-1">
              {loading ? <Loader2 size={18} className="animate-spin mx-auto"/> : 'Record Deposit'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}