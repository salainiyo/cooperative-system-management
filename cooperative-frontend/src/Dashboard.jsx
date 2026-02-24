import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Wallet, 
  Banknote, 
  TrendingUp, 
  AlertCircle, 
  ArrowDownToLine, 
  PiggyBank 
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('access_token');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://localhost:8000/admin/dashboard-stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          setStats(await response.json());
        } else {
          setError("Failed to load dashboard data. Please log in again.");
        }
      } catch (error) {
        setError("Failed to connect to the server.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  // Helper function to format currency nicely (e.g., 1200.5 -> $1,200.50)
  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading dashboard analytics...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-400">{error}</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* HEADER */}
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <LayoutDashboard className="text-indigo-500" /> Cooperative Overview
        </h1>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Members */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-lg flex items-center justify-center">
              <Users size={24} />
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Total Members</p>
          <p className="text-3xl font-bold text-white">{stats.total_members}</p>
        </div>

        {/* Total Savings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center">
              <PiggyBank size={24} />
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Total Savings Pool</p>
          <p className="text-3xl font-bold text-emerald-400">{formatMoney(stats.total_savings)}</p>
        </div>

        {/* Outstanding Principal (Money currently out in the wild) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-amber-500/20 text-amber-400 rounded-lg flex items-center justify-center">
              <Banknote size={24} />
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Outstanding Principal</p>
          <p className="text-3xl font-bold text-amber-400">{formatMoney(stats.outstanding_principal)}</p>
          <p className="text-xs text-slate-500 mt-2">From {stats.total_loans_issued_count} total loans issued</p>
        </div>

        {/* Realized Profit (Interest Collected) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 bg-indigo-500/20 text-indigo-400 rounded-lg flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1">Interest Collected</p>
          <p className="text-3xl font-bold text-indigo-400">{formatMoney(stats.total_interest_collected)}</p>
        </div>

      </div>

      {/* SECONDARY METRICS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Circulation Stats */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex items-center gap-6">
          <div className="p-4 bg-slate-950 rounded-full border border-slate-800">
            <Wallet size={32} className="text-slate-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">Capital Circulation</h3>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-slate-400">Total Principal Loaned:</span>
              <span className="font-medium text-white">{formatMoney(stats.total_principal_loaned)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 flex items-center gap-1"><ArrowDownToLine size={14} className="text-emerald-500"/> Principal Recovered:</span>
              <span className="font-medium text-emerald-400">{formatMoney(stats.total_principal_collected)}</span>
            </div>
          </div>
        </div>

        {/* Risk / Late Fees */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg flex items-center gap-6">
          <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-2">Risk & Penalties</h3>
            <p className="text-slate-400 text-sm mb-1">Projected Late Fees to Collect:</p>
            <p className="text-2xl font-bold text-red-400">{formatMoney(stats.projected_late_fees)}</p>
          </div>
        </div>

      </div>

    </div>
  );
}