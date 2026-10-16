import { useState } from 'react';
import { X, PiggyBank, HandCoins, Loader2 } from 'lucide-react';
import { api } from '../api';
import { formatMoney } from '../utils/format';
import Modal from './ui/Modal';


export default function AddSavingsModal({ memberId, onClose, onSuccess }) {
  const [transactionType, setTransactionType] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isWithdrawal = transactionType === 'withdrawal';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.createSavings(memberId, {
        amount: parseFloat(amount),
        transaction_type: transactionType,
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose} className="">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isWithdrawal ? 'bg-amber-500' : 'bg-emerald-500'}`}>
              {isWithdrawal ? <HandCoins className="w-5 h-5 text-white" /> : <PiggyBank className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Savings Transaction</h2>
              <p className="text-slate-400 text-sm">Record a deposit or withdrawal</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex bg-slate-900 border border-slate-700 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTransactionType('deposit')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${!isWithdrawal ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Deposit
            </button>
            <button
              type="button"
              onClick={() => setTransactionType('withdrawal')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${isWithdrawal ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Withdrawal
            </button>
          </div>

          <div>
            <label htmlFor="savings-amount" className="block text-sm font-medium text-slate-300 mb-2">
              {isWithdrawal ? 'Withdrawal Amount (RWF) *' : 'Deposit Amount (RWF) *'}
            </label>
            <input
              id="savings-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input text-xl font-semibold"
              placeholder="0"
              min="0.01"
              step="0.01"
              required
            />
            <p className="text-xs text-slate-500 mt-2">
              {isWithdrawal
                ? 'Money leaving the member’s savings account'
                : 'Enter the amount the member is depositing'}
            </p>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className={`border rounded-lg p-4 ${isWithdrawal ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <p className={`text-sm mb-1 ${isWithdrawal ? 'text-amber-300' : 'text-emerald-300'}`}>
                {isWithdrawal ? 'Withdrawal' : 'New deposit'}
              </p>
              <p className={`text-2xl font-bold ${isWithdrawal ? 'text-amber-400' : 'text-emerald-400'}`}>
                {isWithdrawal ? '-' : '+'}{formatMoney(amount)} RWF
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 pt-4">
            <button
              type="submit"
              disabled={loading || !amount || parseFloat(amount) <= 0}
              className={`btn flex-1 ${isWithdrawal ? 'btn-primary' : 'btn-success'}`}
            >
              {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : isWithdrawal ? 'Record Withdrawal' : 'Record Deposit'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          </div>
        </form>
    </Modal>
  );
}
