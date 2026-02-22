import { useState, useEffect } from 'react';
import { CreditCard, Plus, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    loan_id: '',
    amount: ''
  });

  const location = useLocation();
  const navigate = useNavigate(); // <-- Added so we can redirect!
  const token = localStorage.getItem('access_token');

  // --- FETCH RECENT PAYMENTS ---
  const fetchPayments = async () => {
    try {
      const response = await fetch('http://localhost:8000/payment/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) setPayments(await response.json());
    } catch (error) {
      console.error("Failed to fetch payments", error);
    }
  };

  // --- SMART DATA LOADER ---
  useEffect(() => {
    fetchPayments();

    if (location.state?.prefillLoanId) {
      setFormData(prev => ({ ...prev, loan_id: location.state.prefillLoanId }));
      setShowAddForm(true);

    } else if (location.state?.payForMemberId) {
      const fetchMemberLoan = async () => {
        try {
          const res = await fetch(`http://localhost:8000/member/${location.state.payForMemberId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const memberData = await res.json();
            if (memberData.active_loans && memberData.active_loans.length > 0) {
              setFormData(prev => ({ ...prev, loan_id: memberData.active_loans[0].id }));
              setShowAddForm(true); 
            } else {
              alert("This member does not currently have an active loan to pay.");
            }
          }
        } catch (error) {
          console.error("Failed to fetch member details", error);
        }
      };
      fetchMemberLoan();
    }
  }, [location.state, token]); 

  // --- RECORD NEW PAYMENT & REDIRECT ---
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/payment/${formData.loan_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: formData.amount })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Payment Successful!\nPrincipal: $${result.principal_amount}\nInterest: $${result.interest_amount}`);
        
        // --- THE MAGIC REDIRECT LOGIC ---
        let targetMemberId = location.state?.payForMemberId;

        // If they typed the Loan ID manually, we need to quickly look up who it belongs to
        if (!targetMemberId) {
          try {
            const loanRes = await fetch('http://localhost:8000/loan/', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (loanRes.ok) {
              const allLoans = await loanRes.json();
              const matchedLoan = allLoans.find(l => l.id === Number(formData.loan_id));
              if (matchedLoan) targetMemberId = matchedLoan.member_id;
            }
          } catch (err) {
            console.error("Failed to lookup member ID for redirection");
          }
        }

        if (targetMemberId) {
          // Teleport straight to their updated profile!
          navigate(`/member/${targetMemberId}`);
        } else {
          // Fallback just in case we couldn't find the member
          setShowAddForm(false);
          setFormData({ loan_id: '', amount: '' });
          fetchPayments(); 
        }

      } else {
        const errData = await response.json();
        alert(`Error: ${errData.detail}`);
      }
    } catch (error) {
      alert("Failed to connect to server.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      
      {/* Header & Actions */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <CreditCard className="text-blue-500" /> Payments Log
        </h1>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium transition-colors"
        >
          {showAddForm ? <X size={20} /> : <Plus size={20} />}
          {showAddForm ? 'Cancel' : 'Record Payment'}
        </button>
      </div>

      {/* THE RECORD PAYMENT FORM */}
      {showAddForm && (
        <form onSubmit={handleRecordPayment} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 shadow-lg flex flex-wrap items-end gap-6">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-slate-400 mb-1">Loan ID</label>
            <input required type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" value={formData.loan_id} onChange={e => setFormData({...formData, loan_id: e.target.value})} placeholder="e.g. 5" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-slate-400 mb-1">Payment Amount ($)</label>
            <input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="100.00" />
          </div>
          <div>
            <button disabled={isLoading} type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 h-[46px]">
              {isLoading ? 'Processing...' : 'Submit Payment'}
            </button>
          </div>
        </form>
      )}

      {/* DATA TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-4 font-medium">Payment ID</th>
              <th className="p-4 font-medium">Loan ID</th>
              <th className="p-4 font-medium">Total Paid</th>
              <th className="p-4 font-medium text-emerald-400">Principal</th>
              <th className="p-4 font-medium text-amber-400">Interest</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {payments.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-slate-500">No payments recorded yet.</td></tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="p-4">#{payment.id}</td>
                  <td className="p-4 font-medium text-slate-200">#{payment.loan_id}</td>
                  <td className="p-4 font-bold text-white">${payment.total_amount}</td>
                  <td className="p-4 text-emerald-400">${payment.principal_amount}</td>
                  <td className="p-4 text-amber-400">${payment.interest_amount}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}