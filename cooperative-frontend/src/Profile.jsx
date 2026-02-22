import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Phone, Wallet, Calendar, ArrowLeft, Banknote, History, CheckCircle2, ListOrdered } from 'lucide-react';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const token = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`http://localhost:8000/member/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          setMember(await response.json());
        } else {
          alert("Member not found!");
          navigate('/members');
        }
      } catch (error) {
        console.error("Failed to fetch profile", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [id, token, navigate]);

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading profile...</div>;
  if (!member) return null;

  // --- SMART CALCULATIONS ---
  
  // 1. Calculate Exact Clearance Amount for the active loan
  let remainingPrincipal = 0;
  let interestDue = 0;
  let lateFees = 0;
  let totalClearanceAmount = 0;

  if (member.active_loans && member.active_loans.length > 0) {
    const loan = member.active_loans[0];
    
    // Sum up the principal they've already paid
    const principalPaid = loan.payments ? loan.payments.reduce((sum, p) => sum + Number(p.principal_amount), 0) : 0;
    
    // Calculate what's left
    remainingPrincipal = Number(loan.amount) - principalPaid;
    
    // Grab the dynamic interest and fees from your backend (defaults to 0 if not present)
    interestDue = Number(loan.current_interest_due || 0);
    lateFees = Number(loan.accumulated_late_fees || 0);
    
    // The magic number: exactly what they need to hand you to clear the debt today
    totalClearanceAmount = remainingPrincipal + interestDue + lateFees;
  }

  // 2. Extract and flatten ALL payments from ALL loans, then sort by newest first (Descending ID)
  const allPayments = [
    ...(member.active_loans || []),
    ...(member.completed_loans || [])
  ].flatMap(loan => 
    (loan.payments || []).map(payment => ({
      ...payment,
      loan_id: loan.id, 
      is_active_loan: loan.status === 'active'
    }))
  ).sort((a, b) => b.id - a.id); 

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      
      {/* HEADER */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/members')} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          Member Profile
        </h1>
      </div>

      {/* TOP ROW: Identity & Savings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex items-center gap-6">
          <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center text-4xl font-bold">
            <User size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">{member.first_name} {member.last_name}</h2>
            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><Phone size={16} /> {member.phone_number}</span>
              <span className="flex items-center gap-1.5"><Calendar size={16} /> DOB: {member.date_of_birth}</span>
              <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300">ID: #{member.id}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex flex-col justify-center">
          <p className="text-slate-400 text-sm font-medium mb-1 flex items-center gap-2">
            <Wallet size={16} className="text-emerald-400"/> Total Savings
          </p>
          <p className="text-4xl font-bold text-emerald-400">${member.savings}</p>
        </div>
      </div>

      {/* MIDDLE SECTION: Active Loan Status */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Banknote className="text-amber-400" /> Current Active Loan
        </h3>
        
        {member.active_loans && member.active_loans.length > 0 ? (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-5">
            <div className="flex justify-between items-start mb-4 border-b border-slate-800 pb-5">
              
              {/* Original Loan Info */}
              <div>
                <p className="text-2xl font-bold text-white">${member.active_loans[0].amount} <span className="text-sm font-normal text-slate-400">Original Principal</span></p>
                <p className="text-sm text-slate-400 mt-1">Due: {new Date(member.active_loans[0].payable_at).toLocaleDateString()}</p>
              </div>
              
              {/* THE UPGRADED PAYOFF AMOUNT */}
              <div className="text-right bg-amber-500/10 px-6 py-3 rounded-lg border border-amber-500/20">
                <p className="text-3xl font-bold text-amber-400">${totalClearanceAmount.toFixed(2)}</p>
                <p className="text-sm text-amber-400/80 mt-1 font-medium">Total to Clear</p>
                
                {/* Breakdown */}
                <div className="mt-2 text-xs text-slate-400 text-right space-y-0.5">
                  <p>Principal left: ${remainingPrincipal.toFixed(2)}</p>
                  <p>Interest due: ${interestDue.toFixed(2)}</p>
                  {lateFees > 0 && <p className="text-red-400">Late fees: ${lateFees.toFixed(2)}</p>}
                </div>
              </div>

            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-4 items-center">
              <div>
                <p className="text-xs text-slate-500">Monthly Payment</p>
                <p className="text-slate-200 font-medium">${member.active_loans[0].monthly_payment}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Payments Made</p>
                <p className="text-slate-200 font-medium">{member.active_loans[0].payments ? member.active_loans[0].payments.length : 0} transactions</p>
              </div>
              <div className="text-right">
                <button 
                  onClick={() => navigate('/payments', { state: { payForMemberId: member.id } })}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors text-sm shadow-sm"
                >
                  Make a Payment
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-slate-950 border border-slate-800 rounded-lg border-dashed">
            <p className="text-slate-400 mb-4">This member is currently debt-free!</p>
            <button 
              onClick={() => navigate('/loans', { state: { prefillMemberId: member.id } })}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium transition-colors text-sm shadow-sm"
            >
              Issue New Loan
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM SECTION: Master Payments Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <ListOrdered className="text-blue-400" /> Full Payment History
        </h3>
        
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4 font-medium">Payment ID</th>
                <th className="p-4 font-medium">Loan ID</th>
                <th className="p-4 font-medium text-emerald-400">Principal Paid</th>
                <th className="p-4 font-medium text-amber-400">Interest Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {allPayments.length === 0 ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-500">No payments have been recorded for this member.</td></tr>
              ) : (
                allPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 text-white font-medium">#{payment.id}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${payment.is_active_loan ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                        Loan #{payment.loan_id}
                      </span>
                    </td>
                    <td className="p-4 text-emerald-400 font-medium">${payment.principal_amount}</td>
                    <td className="p-4 text-amber-400">${payment.interest_amount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}