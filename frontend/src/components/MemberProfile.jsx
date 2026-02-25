import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User,
  Phone,
  MapPin,
  Calendar,
  Wallet,
  TrendingUp,
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle,
  History
} from 'lucide-react';
import { api } from '../api';
import AddSavingsModal from './AddSavingsModal';
import IssueLoanModal from './IssueLoanModal';
import MakePaymentModal from './MakePaymentModal';
import EditMemberModal from './EditMemberModal';

const formatMoney = (amount) => parseFloat(amount || 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-RW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function MemberProfile() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  
  const [member, setMember] = useState(null);
  const [savingsHistory, setSavingsHistory] = useState([]); // <-- Added state for savings history
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [showAddSavings, setShowAddSavings] = useState(false);
  const [showIssueLoan, setShowIssueLoan] = useState(false);
  const [showMakePayment, setShowMakePayment] = useState(false);
  const [showEditMember, setShowEditMember] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);

  useEffect(() => {
    loadMemberDetails();
  }, [memberId]);

  const loadMemberDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both Member Details AND Savings History simultaneously
      const [memberData, savingsData] = await Promise.all([
        api.getMemberDetails(memberId),
        api.getMemberSavings(memberId, 0, 50) // Fetches up to 50 recent savings transactions
      ]);
      
      setMember(memberData);
      setSavingsHistory(savingsData || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!window.confirm(`Are you sure you want to delete ${member.first_name} ${member.last_name}? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteMember(memberId);
      navigate('/members');
    } catch (error) {
      alert(`Failed to delete member: ${error.message}`);
    }
  };

  const handleDeleteLoan = async (loanId) => {
    if (!window.confirm('Are you sure you want to delete this loan? This will also delete all associated payments.')) {
      return;
    }
    try {
      await api.deleteLoan(loanId);
      loadMemberDetails();
    } catch (error) {
      alert(`Failed to delete loan: ${error.message}`);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) {
      return;
    }
    try {
      await api.deletePayment(paymentId);
      loadMemberDetails();
    } catch (error) {
      alert(`Failed to delete payment: ${error.message}`);
    }
  };

  const handleActionSuccess = () => {
    loadMemberDetails();
    setShowAddSavings(false);
    setShowIssueLoan(false);
    setShowMakePayment(false);
    setShowEditMember(false);
    setSelectedLoan(null);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-slate-800 rounded w-64"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-64 bg-slate-800 rounded-lg"></div>
          <div className="lg:col-span-2 h-64 bg-slate-800 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-400 mb-4">{error}</p>
          <button onClick={() => navigate('/members')} className="btn btn-primary">
            Back to Members
          </button>
        </div>
      </div>
    );
  }

  // Extract and combine all payments from all loans (Active + Completed) into one unified ledger
  const allPayments = [
    ...(member.active_loans || []).flatMap(loan => (loan.payments || []).map(p => ({ ...p, loan_id: loan.id }))),
    ...(member.completed_loans || []).flatMap(loan => (loan.payments || []).map(p => ({ ...p, loan_id: loan.id })))
  ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/members')} className="btn btn-ghost gap-2">
          <ArrowLeft className="w-5 h-5" /> Back to Members
        </button>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setShowEditMember(true)} className="btn btn-ghost gap-2">
            <Edit2 className="w-4 h-4" /> Edit
          </button>
          <button onClick={handleDeleteMember} className="btn btn-danger gap-2">
            <Trash2 className="w-4 h-4" /> Delete Member
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Member Info & Actions */}
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center mb-4">
                <User className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-1">
                {member.first_name} {member.last_name}
              </h2>
              <p className="text-slate-400 text-sm">Member #{member.id}</p>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-slate-300">
                <Phone className="w-4 h-4 text-slate-500" />
                <span>{member.phone_number}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span>Born {formatDateTime(member.date_of_birth).split(',')[0]}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <User className="w-4 h-4 text-slate-500" />
                <span>{member.gender}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <MapPin className="w-4 h-4 text-slate-500" />
                <span>Joined {formatDateTime(member.created_at).split(',')[0]}</span>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <Wallet className="w-6 h-6" />
              <h3 className="text-lg font-semibold">Total Savings</h3>
            </div>
            <p className="text-4xl font-bold mb-2">
              {formatMoney(member.total_savings)} RWF
            </p>
            <p className="text-emerald-100 text-sm">Available for loans</p>
          </div>

          <div className="space-y-2">
            <button onClick={() => setShowAddSavings(true)} className="btn btn-success w-full gap-2">
              <Plus className="w-5 h-5" /> Add Savings
            </button>
            <button 
              onClick={() => setShowIssueLoan(true)} 
              className="btn btn-primary w-full gap-2"
              disabled={member.active_loans?.length >= 1}
            >
              <Plus className="w-5 h-5" /> Issue New Loan
            </button>
          </div>
        </div>

        {/* Right Column - Active & Completed Loans Overview */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Loans */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" /> Active Loans
              </h3>
              {member.active_loans?.length > 0 && (
                <span className="px-3 py-1 bg-amber-500/10 text-amber-400 rounded-full text-sm font-medium">
                  {member.active_loans.length} Active
                </span>
              )}
            </div>

            {!member.active_loans || member.active_loans.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>No active loans</p>
              </div>
            ) : (
              <div className="space-y-4">
                {member.active_loans.map((loan) => (
                  <div key={loan.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-slate-400 text-sm mb-1">Loan #{loan.id}</p>
                        <p className="text-2xl font-bold text-slate-100">
                          {formatMoney(loan.amount)} RWF
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setSelectedLoan(loan); setShowMakePayment(true); }} className="btn btn-success btn-sm gap-2">
                          <Plus className="w-4 h-4" /> Payment
                        </button>
                        <button onClick={() => handleDeleteLoan(loan.id)} className="btn btn-ghost btn-sm">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm bg-slate-900/50 p-3 rounded-lg">
                      <div>
                        <p className="text-slate-400 mb-1">Remaining Balance</p>
                        <p className="text-slate-200 font-semibold">{formatMoney(loan.remaining_balance)} RWF</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Interest Due</p>
                        <p className="text-amber-400 font-semibold">{formatMoney(loan.current_interest_due)} RWF</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Late Fees</p>
                        <p className="text-red-400 font-semibold">{formatMoney(loan.accumulated_late_fees)} RWF</p>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">Monthly Target</p>
                        <p className="text-slate-200 font-semibold">{formatMoney(loan.monthly_payment)} RWF</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Loans */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" /> Completed Loans
              </h3>
              {member.completed_loans?.length > 0 && (
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-sm font-medium">
                  {member.completed_loans.length} Paid
                </span>
              )}
            </div>

            {!member.completed_loans || member.completed_loans.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p>No completed loans</p>
              </div>
            ) : (
              <div className="space-y-3">
                {member.completed_loans.map((loan) => (
                  <div key={loan.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg p-4">
                    <div>
                      <p className="text-slate-400 text-sm">Loan #{loan.id}</p>
                      <p className="text-slate-200 font-semibold">
                        {formatMoney(loan.amount)} RWF
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-400 text-sm font-medium">Fully Paid</p>
                      <p className="text-slate-500 text-xs">{formatDateTime(loan.updated_at).split(',')[0]}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================= */}
      {/* DETAILED TRANSACTION LEDGERS (NEW SECTION) */}
      {/* ========================================= */}
      <div className="mt-8 pt-6 border-t border-slate-800">
        <h2 className="text-2xl font-bold text-slate-100 mb-6">Historical Ledgers</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Savings Ledger Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-96">
            <div className="p-5 border-b border-slate-800 flex items-center gap-3 bg-slate-900/80">
              <History className="text-emerald-500 w-5 h-5" />
              <h3 className="font-semibold text-white">Savings History</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-xs tracking-wider sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-5 py-3">Date & Time</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {savingsHistory.length > 0 ? (
                    savingsHistory.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 text-slate-300">{formatDateTime(s.created_at || s.updated_at)}</td>
                        <td className="px-5 py-4 text-right font-semibold text-emerald-400">
                          +{formatMoney(s.amount)} RWF
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2" className="px-5 py-12 text-center text-slate-500 italic">No savings deposits recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Ledger Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-96">
            <div className="p-5 border-b border-slate-800 flex items-center gap-3 bg-slate-900/80">
              <History className="text-indigo-500 w-5 h-5" />
              <h3 className="font-semibold text-white">Loan Payments History</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-xs tracking-wider sticky top-0 backdrop-blur-md">
                  <tr>
                    <th className="px-5 py-3">Date & Time</th>
                    <th className="px-5 py-3 text-center">Loan ID</th>
                    <th className="px-5 py-3 text-right">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {allPayments.length > 0 ? (
                    allPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 text-slate-300 flex flex-col gap-1">
                           <span>{formatDateTime(p.created_at || p.paid_at)}</span>
                           <button onClick={() => handleDeletePayment(p.id)} className="text-xs text-red-500/50 hover:text-red-400 w-fit">Reverse</button>
                        </td>
                        <td className="px-5 py-4 text-center text-slate-400">#{p.loan_id}</td>
                        <td className="px-5 py-4 text-right font-semibold text-indigo-400">
                          +{formatMoney(p.total_amount || p.amount)} RWF
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-5 py-12 text-center text-slate-500 italic">No loan payments recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      {/* Modals */}
      {showAddSavings && <AddSavingsModal memberId={memberId} onClose={() => setShowAddSavings(false)} onSuccess={handleActionSuccess} />}
      {showIssueLoan && <IssueLoanModal member={member} onClose={() => setShowIssueLoan(false)} onSuccess={handleActionSuccess} />}
      {showMakePayment && selectedLoan && <MakePaymentModal loan={selectedLoan} onClose={() => { setShowMakePayment(false); setSelectedLoan(null); }} onSuccess={handleActionSuccess} />}
      {showEditMember && <EditMemberModal member={member} onClose={() => setShowEditMember(false)} onSuccess={handleActionSuccess} />}
    </div>
  );
}