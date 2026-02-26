import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Phone, User, AlertCircle, ArrowRight, Wallet, AlertTriangle, CalendarDays, Filter } from 'lucide-react';
import { api } from '../api';
import AddToCalendarBtn from './AddToCalendarBtn'; // <-- Imported the new button!

const formatMoney = (amount) => parseFloat(amount || 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });

// Helper to check if a date is within the next X days
const isWithinDays = (targetDate, days) => {
  if (!targetDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); 
  
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0); 
  
  const diffTime = target - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays >= 0 && diffDays <= days;
};

export default function CollectionsReport() {
  const [allLoans, setAllLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    generateReport();
  }, []);

  const generateReport = async () => {
    setLoading(true);
    try {
      const data = await api.getMembers(0, 500);
      const members = data.members;

      const detailedMembers = await Promise.all(
        members.map(m => api.getMemberDetails(m.id).catch(() => null))
      );

      const extractedLoans = [];
      detailedMembers.forEach(member => {
        if (member && member.active_loans && member.active_loans.length > 0) {
          member.active_loans.forEach(loan => {
            const exactNextDate = loan.next_due_date ? new Date(loan.next_due_date) : null;
            
            extractedLoans.push({
              ...loan,
              next_payment_date: exactNextDate,
              member: {
                id: member.id,
                first_name: member.first_name,
                last_name: member.last_name,
                phone_number: member.phone_number
              }
            });
          });
        }
      });

      extractedLoans.sort((a, b) => {
        const aLate = parseFloat(a.accumulated_late_fees || 0);
        const bLate = parseFloat(b.accumulated_late_fees || 0);
        if (bLate !== aLate) return bLate - aLate;
        return parseFloat(b.remaining_balance) - parseFloat(a.remaining_balance);
      });

      setAllLoans(extractedLoans);
    } catch (err) {
      setError("Failed to generate collections report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const displayedLoans = allLoans.filter(loan => {
    if (filterType === 'all') return true;
    if (filterType === 'overdue') return parseFloat(loan.accumulated_late_fees || 0) > 0;
    if (filterType === 'this_week') {
      const dueSoon = isWithinDays(loan.next_payment_date, 7);
      const isOverdue = parseFloat(loan.accumulated_late_fees || 0) > 0;
      return dueSoon || isOverdue;
    }
    return true;
  });

  const totalExpected = displayedLoans.reduce((sum, loan) => sum + parseFloat(loan.monthly_payment || 0), 0);
  const totalLateFees = displayedLoans.reduce((sum, loan) => sum + parseFloat(loan.accumulated_late_fees || 0), 0);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-64 mb-8"></div>
        <div className="flex gap-4 mb-6">
           <div className="h-10 bg-slate-800 rounded-lg w-32"></div>
           <div className="h-10 bg-slate-800 rounded-lg w-32"></div>
           <div className="h-10 bg-slate-800 rounded-lg w-32"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-800 rounded-lg"></div>)}
        </div>
        <div className="h-96 bg-slate-800 rounded-2xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-slate-400">{error}</p>
        <button onClick={generateReport} className="btn btn-primary mt-4">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Collections Radar</h1>
          <p className="text-slate-400">Track active loans, overdue accounts, and upcoming due dates.</p>
        </div>
        
        <div className="flex bg-slate-900 border border-slate-700 p-1 rounded-xl">
          <button onClick={() => setFilterType('all')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${filterType === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            <Wallet size={16} /> All Active
          </button>
          <button onClick={() => setFilterType('this_week')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${filterType === 'this_week' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            <CalendarDays size={16} /> Due This Week
          </button>
          <button onClick={() => setFilterType('overdue')} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${filterType === 'overdue' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            <AlertTriangle size={16} /> Overdue
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${filterType === 'this_week' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
              <CalendarClock size={20} />
            </div>
            <h3 className="text-slate-400 font-medium text-sm">Targeted Loans</h3>
          </div>
          <p className="text-3xl font-bold text-slate-100">{displayedLoans.length}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg"><Wallet size={20} /></div>
            <h3 className="text-slate-400 font-medium text-sm">Expected Collection</h3>
          </div>
          <p className="text-3xl font-bold text-emerald-400">{formatMoney(totalExpected)} RWF</p>
        </div>

        <div className="bg-slate-900 border border-red-500/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2 relative z-10">
            <div className="p-2 bg-red-500/10 text-red-400 rounded-lg"><AlertTriangle size={20} /></div>
            <h3 className="text-red-300 font-medium text-sm">Targeted Late Fees</h3>
          </div>
          <p className="text-3xl font-bold text-red-400 relative z-10">{formatMoney(totalLateFees)} RWF</p>
          {totalLateFees > 0 && <div className="absolute -right-4 -bottom-4 opacity-5"><AlertTriangle size={120} /></div>}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-xs tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Member Info</th>
                <th className="px-6 py-4">Loan Balance</th>
                <th className="px-6 py-4 text-emerald-400">Monthly Target</th>
                <th className="px-6 py-4 text-indigo-400">Next Due Date</th>
                <th className="px-6 py-4 text-red-400">Overdue Fees</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {displayedLoans.length > 0 ? (
                displayedLoans.map((loan) => {
                  const hasLateFees = parseFloat(loan.accumulated_late_fees || 0) > 0;
                  const isDueSoon = isWithinDays(loan.next_payment_date, 7);
                  
                  return (
                    <tr key={loan.id} className={`hover:bg-slate-800/30 transition-colors ${hasLateFees ? 'bg-red-500/5' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasLateFees ? 'bg-red-500/20 text-red-400' : 'bg-slate-800 text-slate-400'}`}>
                            <User size={18} />
                          </div>
                          <div>
                            <p className="text-slate-200 font-semibold">{loan.member.first_name} {loan.member.last_name}</p>
                            <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5">
                              <Phone size={10} /> {loan.member.phone_number}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300 font-medium">
                        {formatMoney(loan.remaining_balance)} RWF
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-400">
                        {formatMoney(loan.monthly_payment)} RWF
                      </td>
                      <td className="px-6 py-4 font-medium">
                        {loan.next_payment_date ? (
                          <span className={isDueSoon ? 'text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md' : 'text-slate-400'}>
                            {loan.next_payment_date.toLocaleDateString('en-RW', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        ) : (
                          <span className="text-slate-600">No due date</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {hasLateFees ? (
                          <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-md font-semibold text-xs flex items-center gap-1 w-fit">
                            <AlertCircle size={12} /> {formatMoney(loan.accumulated_late_fees)} RWF
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {/* Calendar Button integration */}
                          <AddToCalendarBtn loan={loan} />
                          
                          <Link 
                            to={`/member/${loan.member.id}`}
                            className="inline-flex items-center justify-center p-2 text-indigo-400 hover:text-white hover:bg-indigo-500 rounded-lg transition-colors"
                            title="Go to Profile to process payment"
                          >
                            <ArrowRight size={20} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-16 text-center">
                     <div className="flex flex-col items-center justify-center">
                        <Filter className="w-12 h-12 text-slate-600 mb-4" />
                        <p className="text-slate-400 font-medium text-lg">No loans match this filter!</p>
                        <p className="text-slate-500 text-sm mt-1">Looks like the collections board is clear.</p>
                     </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}