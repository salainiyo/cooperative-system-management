import { useState } from 'react';
import { X, UserPlus, Loader2 } from 'lucide-react';
import { api } from '../api';
import { useToast } from '../context/ToastContext'; 

export default function AddMemberModal({ onClose, onSuccess }) {
  // PERFECTLY MATCHED TO YOUR FASTAPI MODEL
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    gender: '',
    date_of_birth: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { showToast } = useToast();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.createMember(formData);
      showToast(`Successfully registered ${formData.first_name} ${formData.last_name}!`); 
      onSuccess(); 
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ensure all required fields are filled before enabling the button
  const isFormValid = formData.first_name && formData.last_name && formData.phone_number && formData.gender && formData.date_of_birth;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">Register New Member</h2>
              <p className="text-slate-400 text-sm">Add a new member to the cooperative</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">First Name *</label>
              <input type="text" name="first_name" value={formData.first_name} onChange={handleChange} className="input" placeholder="John" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Last Name *</label>
              <input type="text" name="last_name" value={formData.last_name} onChange={handleChange} className="input" placeholder="Doe" required />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number *</label>
            <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} className="input" placeholder="078..." required />
          </div>

          {/* NEW FIELDS: Gender and DOB */}
          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Gender *</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="input" required>
                <option value="" disabled>Select gender...</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Date of Birth *</label>
              <input type="date" name="date_of_birth" value={formData.date_of_birth} onChange={handleChange} className="input" required />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-6">
            <button type="submit" disabled={loading || !isFormValid} className="btn btn-primary flex-1">
              {loading ? <Loader2 size={18} className="animate-spin mx-auto"/> : 'Register Member'}
            </button>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}