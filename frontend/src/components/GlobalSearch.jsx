import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, User, Phone, Loader2 } from 'lucide-react';
import { api } from '../api';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search with debounce
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchMembers(query);
        setResults(data);
        setShowDropdown(true);
      } catch (error) {
        console.error('Search failed:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectMember = (memberId) => {
    navigate(`/member/${memberId}`);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div ref={searchRef} className="relative">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowDropdown(true)}
          placeholder="Search members by name or phone..."
          className="input pl-10 pr-10 bg-slate-800 border-slate-700"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400 animate-spin" />
        )}
      </div>

      {/* Results Dropdown */}
      {showDropdown && (
        <div className="absolute top-full mt-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-2xl max-h-96 overflow-y-auto z-50 animate-fade-in">
          {results.length === 0 ? (
            <div className="p-4 text-center text-slate-400">
              {query.length < 2 ? (
                'Type at least 2 characters to search'
              ) : (
                'No members found'
              )}
            </div>
          ) : (
            <div className="py-2">
              {results.map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleSelectMember(member.id)}
                  className="w-full px-4 py-3 hover:bg-slate-700 transition-colors flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 font-medium truncate">
                      {member.first_name} {member.last_name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Phone className="w-3 h-3" />
                      <span>{member.phone_number}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
