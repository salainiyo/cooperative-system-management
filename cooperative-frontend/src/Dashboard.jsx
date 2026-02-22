import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // This runs automatically when the Dashboard loads
    const fetchDashboardStats = async () => {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        navigate('/'); // If no token, kick them back to login
        return;
      }

      try {
        const response = await fetch('http://localhost:8000/admin/dashboard-stats', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('access_token');
          navigate('/');
          return;
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError('Failed to connect to the server.');
      }
    };

    fetchDashboardStats();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/');
  };

  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!stats) return <div className="p-8 text-slate-400">Loading your financial data...</div>;

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Navbar */}
        <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800">
          <h1 className="text-3xl font-bold text-white">Cooperative Overview</h1>
          <button 
            onClick={handleLogout}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-slate-400 text-sm font-medium mb-1">Total Members</h3>
            <p className="text-3xl font-bold text-white">{stats.total_members}</p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-slate-400 text-sm font-medium mb-1">Total Savings</h3>
            <p className="text-3xl font-bold text-emerald-400">${stats.total_savings}</p>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-slate-400 text-sm font-medium mb-1">Outstanding Principal</h3>
            <p className="text-3xl font-bold text-amber-400">${stats.outstanding_principal}</p>
          </div>

          {/* Card 4 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-slate-400 text-sm font-medium mb-1">Realized Interest Profit</h3>
            <p className="text-3xl font-bold text-indigo-400">${stats.total_interest_collected}</p>
          </div>

        </div>
      </div>
    </div>
  );
}