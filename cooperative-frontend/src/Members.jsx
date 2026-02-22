import { useState } from 'react';
import { Search, Plus, X, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const navigate = useNavigate();
  
  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', date_of_birth: '', 
    gender: 'Male', phone_number: '', savings: '0.00'
  });

  const token = localStorage.getItem('access_token');

  // --- SEARCH MEMBERS ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.length < 2) return; // Backend requires min 2 chars
    
    setIsSearching(true);
    try {
      const response = await fetch(`http://localhost:8000/member/search?q=${searchQuery}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  // --- ADD NEW MEMBER ---
  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:8000/member/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert("Member added successfully!");
        setShowAddForm(false);
        setFormData({ first_name: '', last_name: '', date_of_birth: '', gender: 'Male', phone_number: '', savings: '0.00' });
        // Automatically search for the new member to show them in the table
        setSearchQuery(formData.phone_number);
      } else {
        const errData = await response.json();
        alert(`Error: ${errData.detail}`);
      }
    } catch (error) {
      alert("Failed to connect to server.");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      
      {/* Header & Actions */}
      <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <User className="text-indigo-500" /> Member Directory
        </h1>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium transition-colors"
        >
          {showAddForm ? <X size={20} /> : <Plus size={20} />}
          {showAddForm ? 'Cancel' : 'New Member'}
        </button>
      </div>

      {/* THE ADD MEMBER FORM (Hides when not active) */}
      {showAddForm && (
        <form onSubmit={handleAddMember} className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 shadow-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm text-slate-400 mb-1">First Name</label>
            <input required type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Last Name</label>
            <input required type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Phone Number</label>
            <input required type="text" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Date of Birth</label>
            <input required type="date" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.date_of_birth} onChange={e => setFormData({...formData, date_of_birth: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Gender</label>
            <select className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
              <option>Male</option>
              <option>Female</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Initial Savings ($)</label>
            <input required type="number" step="0.01" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.savings} onChange={e => setFormData({...formData, savings: e.target.value})} />
          </div>
          <div className="col-span-full flex justify-end">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">Save Member</button>
          </div>
        </form>
      )}

      {/* SEARCH BAR */}
      <form onSubmit={handleSearch} className="mb-6 relative">
        <Search className="absolute left-4 top-3.5 text-slate-500" size={20} />
        <input 
          type="text" 
          placeholder="Search by name or phone (min 2 chars)..." 
          className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:border-indigo-500 focus:outline-none"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button type="submit" className="absolute right-2 top-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm">
          {isSearching ? '...' : 'Search'}
        </button>
      </form>

      {/* DATA TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-4 font-medium">ID</th>
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Phone</th>
              <th className="p-4 font-medium">Savings</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {members.length === 0 ? (
              <tr><td colSpan="5" className="p-8 text-center text-slate-500">No members found. Try searching!</td></tr>
            ) : (
              members.map((member) => (
                <tr key={member.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="p-4">#{member.id}</td>
                  <td className="p-4 font-medium text-slate-200">{member.first_name} {member.last_name}</td>
                  <td className="p-4">{member.phone_number}</td>
                  <td className="p-4 text-emerald-400 font-medium">${member.savings}</td>
                  <td className="p-4 text-right flex justify-end gap-2">
                    <button 
                      onClick={() => navigate(`/member/${member.id}`)}
                      className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-md transition-colors text-sm font-medium"
                    >
                      View Profile
                    </button>
                    
                    <button 
                      onClick={() => navigate('/loans', { state: { prefillMemberId: member.id } })}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md transition-colors text-sm font-medium shadow-sm"
                    >
                      Issue Loan
                    </button>

                    {/* NEW MAKE PAYMENT BUTTON */}
                    <button 
                      onClick={() => navigate('/payments', { state: { payForMemberId: member.id } })}
                      className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-md transition-colors text-sm font-medium shadow-sm"
                    >
                      Make Payment
                    </button>
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