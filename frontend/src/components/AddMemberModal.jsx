import { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { api } from '../api';

export default function AddMemberModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    date_of_birth: '',
    gender: 'Other',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.createMember(formData);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Add New Member</h2>
              <p className="text-slate-400 text-sm">Register a new cooperative member</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="w-6 h-6" /></button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-2">First Name *</label><input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="input" required /></div>
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Last Name *</label><input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="input" required /></div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Phone Number *</label><input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} className="input" placeholder="078..." required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Date of Birth *</label><input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="input" required /></div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Gender *</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="input">
                <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-4">
            <button type="submit" disabled={loading} className="btn btn-primary flex-1">
              {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'Create Member'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}