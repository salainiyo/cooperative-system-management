import { useState, useEffect } from 'react';
import { Banknote, Plus, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Loans() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loans, setLoans] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Loan Form State
  const [formData, setFormData] = useState({
    member_id: '',
    amount: '',
    payable_at: '',
    monthly_payment: ''
  });

  const token = localStorage.getItem('access_token');

  useEffect(() => {
    if (location.state?.prefillMemberId) {
      setFormData(prev => ({ ...prev, member_id: location.state.prefillMemberId }));
      setShowAddForm(true); // Automatically drop down the form!
    }
  }, [location]);

  // --- FETCH ALL LOANS ---
  const fetchLoans = async () => {
    try {
      const response = await fetch('http://localhost:8000/loan/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLoans(data);
      }
    } catch (error) {
      console.error("Failed to fetch loans", error);
    }
  };

  // Fetch loans when the page loads
  useEffect(() => {
    fetchLoans();
  }, []);

  // --- ISSUE NEW LOAN ---
  const handleIssueLoan = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/loan/${formData.member_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: formData.amount,
          payable_at: formData.payable_at,
          monthly_payment: formData.monthly_payment
        })
      });

      if (response.ok) {
        alert("Loan issued successfully!");
        setShowAddForm(false);
        setFormData({ member_id: '', amount: '', payable_at: '', monthly_payment: '' });
        fetchLoans(); // Refresh the table
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
          <Banknote className="text-emerald-500" /> Loan Management
        </h1>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-medium transition-colors"
        >
          {showAddForm ? <X size={20} /> : <Plus size={20} />}
          {showAddForm ? 'Cancel' : 'Issue Loan'}
        </button>
      </div>

      {/* THE ISSUE LOAN FORM */}
      {showAddForm && (
        <form onSubmit={handleIssueLoan} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 shadow-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Member ID</label>
            <input required type="number" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.member_id} onChange={e => setFormData({...formData, member_id: e.target.value})} placeholder="e.g. 1" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Loan Amount ($)</label>
            <input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Monthly Payment ($)</label>
            <input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.monthly_payment} onChange={e => setFormData({...formData, monthly_payment: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Payable At (Deadline)</label>
            <input required type="date" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.payable_at} onChange={e => setFormData({...formData, payable_at: e.target.value})} />
          </div>
          <div className="col-span-full flex justify-end">
            <button disabled={isLoading} type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50">
              {isLoading ? 'Processing...' : 'Confirm Loan'}
            </button>
          </div>
        </form>
      )}

      {/* DATA TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-4 font-medium">Loan ID</th>
              <th className="p-4 font-medium">Member ID</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Monthly Pay</th>
              <th className="p-4 font-medium">Deadline</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {loans.length === 0 ? (
              <tr><td colSpan="7" className="p-8 text-center text-slate-500">No active loans found.</td></tr>
            ) : (
              loans.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="p-4">#{loan.id}</td>
                  <td className="p-4 flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">{loan.member_id}</div></td>
                  <td className="p-4 text-emerald-400 font-medium">${loan.amount}</td>
                  <td className="p-4">${loan.monthly_payment}</td>
                  <td className="p-4">{new Date(loan.payable_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${loan.status === 'active' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                      {loan.status ? loan.status.toUpperCase() : 'ACTIVE'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {loan.status !== 'paid' && (
                      <button 
                        onClick={() => navigate('/payments', { state: { prefillLoanId: loan.id } })}
                        className="px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors text-sm font-medium shadow-sm inline-block"
                      >
                        Receive Payment
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}