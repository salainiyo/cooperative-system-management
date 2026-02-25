import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Phone, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { api } from '../api';
import AddMemberModal from './AddMemberModal';

const formatMoney = (amount) => parseFloat(amount || 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });

export default function MembersDirectory() {
  const [members, setMembers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => { loadMembers(); }, [offset]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const data = await api.getMembers(offset, limit);
      setMembers(data.members);
      setTotalCount(data.total_count);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMemberAdded = () => {
    loadMembers();
    setShowAddModal(false);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Members Directory</h1>
          <p className="text-slate-400">{totalCount} total members registered</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn btn-primary gap-2">
          <Plus className="w-5 h-5" /> Add New Member
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-800 rounded-lg animate-pulse"></div>)}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12"><User className="w-12 h-12 text-slate-600 mx-auto mb-4" /><p className="text-slate-400">No members found</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member) => (
            <Link key={member.id} to={`/member/${member.id}`} className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-indigo-500 transition-all hover:shadow-lg hover:shadow-indigo-500/10">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-slate-200 font-semibold truncate">{member.first_name} {member.last_name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-400 mt-1"><Phone className="w-3 h-3" /><span>{member.phone_number}</span></div>
                  {member.total_savings != null && (
                    <div className="mt-2 text-xs text-emerald-400 font-medium">{formatMoney(member.total_savings)} RWF savings</div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-6 border-t border-slate-800">
          <p className="text-sm text-slate-400">Showing {offset + 1} to {Math.min(offset + limit, totalCount)} of {totalCount} members</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className="btn btn-ghost"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-sm text-slate-400">Page {currentPage} of {totalPages}</span>
            <button onClick={() => setOffset(offset + limit)} disabled={offset + limit >= totalCount} className="btn btn-ghost"><ChevronRight className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      {showAddModal && <AddMemberModal onClose={() => setShowAddModal(false)} onSuccess={handleMemberAdded} />}
    </div>
  );
}