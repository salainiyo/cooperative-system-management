import { useState, useEffect } from 'react';
import { X, Printer, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { formatMoney } from '../utils/format';
import Modal from './ui/Modal';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-RW', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

export default function MemberStatement({ member, onClose }) {
  const [statement, setStatement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getMemberStatement(member.id);
        if (!cancelled) {
          setStatement(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [member.id]);

  const savings = statement?.savings || [];
  const payments = statement?.payments || [];
  const totals = statement?.summary || {};

  return (
    <Modal onClose={onClose} className="max-w-4xl">
        <div className="flex items-center justify-between mb-6 print-hide">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Member Statement</h2>
            <p className="text-slate-400 text-sm">
              {member.first_name} {member.last_name} · Member #{member.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} disabled={loading} className="btn btn-primary gap-2">
              <Printer size={16} /> Print
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="print-area max-h-[70vh] overflow-y-auto pr-2">
          <div className="mb-6 hidden print:block">
            <h1 className="text-2xl font-bold">Ikimina Cooperative — Member Statement</h1>
            <p className="text-sm text-slate-600">Generated {new Date().toLocaleDateString('en-RW')}</p>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading statement…
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {!loading && !error && statement && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Total Deposits</p>
                  <p className="text-emerald-400 font-bold">{formatMoney(totals.total_deposits)} RWF</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Total Withdrawals</p>
                  <p className="text-amber-400 font-bold">{formatMoney(totals.total_withdrawals)} RWF</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Total Loan Payments</p>
                  <p className="text-indigo-400 font-bold">{formatMoney(totals.total_loan_payments)} RWF</p>
                </div>
                <div className="bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Transactions</p>
                  <p className="text-slate-200 font-bold">{savings.length + payments.length}</p>
                </div>
              </div>

              <h3 className="font-semibold text-slate-200 mb-2">Savings</h3>
              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="py-2">Date</th>
                    <th className="py-2">Type</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="py-2 text-right">Balance After</th>
                  </tr>
                </thead>
                <tbody>
                  {savings.length === 0 ? (
                    <tr><td colSpan="4" className="py-4 text-slate-500 italic">No savings transactions in this period.</td></tr>
                  ) : (
                    savings.map((s) => (
                      <tr key={s.id} className="border-b border-slate-800/40">
                        <td className="py-2 text-slate-300">{formatDate(s.created_at)}</td>
                        <td className="py-2 text-slate-400 capitalize">{s.transaction_type}</td>
                        <td className={`py-2 text-right font-semibold ${s.transaction_type === 'withdrawal' ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {s.transaction_type === 'withdrawal' ? '−' : '+'}{formatMoney(s.amount)}
                        </td>
                        <td className="py-2 text-right text-slate-300">{s.balance_after != null ? formatMoney(s.balance_after) : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <h3 className="font-semibold text-slate-200 mb-2">Loan Payments</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="py-2">Date</th>
                    <th className="py-2">Loan</th>
                    <th className="py-2 text-right">Principal</th>
                    <th className="py-2 text-right">Interest</th>
                    <th className="py-2 text-right">Late Fee</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 ? (
                    <tr><td colSpan="6" className="py-4 text-slate-500 italic">No loan payments in this period.</td></tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/40">
                        <td className="py-2 text-slate-300">{formatDate(p.paid_at)}</td>
                        <td className="py-2 text-slate-400">#{p.loan_id}</td>
                        <td className="py-2 text-right text-slate-300">{formatMoney(p.principal_amount)}</td>
                        <td className="py-2 text-right text-slate-300">{formatMoney(p.interest_amount)}</td>
                        <td className="py-2 text-right text-red-400">{formatMoney(p.late_fee_amount)}</td>
                        <td className="py-2 text-right font-semibold text-indigo-400">{formatMoney(p.total_amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
    </Modal>
  );
}
