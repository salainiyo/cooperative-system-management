import { useState, useEffect } from 'react';
import { 
  Users, 
  Vault, 
  TrendingUp, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  PiggyBank,
  Wallet
} from 'lucide-react';
import { api } from '../api';

// Helper to remove those 10 trailing zeroes!
const formatMoney = (amount) => parseFloat(amount || 0).toLocaleString('en-RW', { maximumFractionDigits: 0 });

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      const data = await api.getDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-64"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-slate-400">Failed to load dashboard: {error}</p>
          <button onClick={loadDashboardStats} className="btn btn-primary mt-4">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ==========================================
  // MATH SAFETY ZONE (Prevents NaN errors)
  // ==========================================
  const safeTotalSavings = parseFloat(stats.total_savings || 0);
  const safeOutstanding = parseFloat(stats.outstanding_principal || 0);
  const safeInterest = parseFloat(stats.total_interest_collected || 0);
  const safeLateFees = parseFloat(stats.projected_late_fees || 0);
  const safeLoaned = parseFloat(stats.total_principal_loaned || 0);
  const safeCollected = parseFloat(stats.total_principal_collected || 0);

  const netProfit = safeInterest + safeLateFees;
  
  // Liquidity Ratio: (Cash in Vault / Total Savings) * 100
  const cashInVault = Math.max(0, safeTotalSavings - safeOutstanding);
  const liquidityRatio = safeTotalSavings > 0 
    ? ((cashInVault / safeTotalSavings) * 100).toFixed(1) 
    : 0;

  // Recovery Rate: (Money Paid Back / Money Loaned Out) * 100
  const recoveryRate = safeLoaned > 0 
    ? ((safeCollected / safeLoaned) * 100).toFixed(1) 
    : 0;

  // ==========================================

  const metrics = [
    {
      label: 'Total Members',
      value: stats.total_members,
      icon: Users,
      color: 'indigo',
      trend: null,
    },
    {
      label: 'Vault Balance',
      value: `${formatMoney(safeTotalSavings)} RWF`,
      icon: Vault,
      color: 'emerald',
      trend: null,
      subtitle: 'Total member savings',
    },
    {
      label: 'Loans Issued',
      value: stats.total_loans_issued_count,
      icon: TrendingUp,
      color: 'blue',
      trend: null,
      subtitle: `${formatMoney(safeLoaned)} RWF total`,
    },
    {
      label: 'Principal Collected',
      value: `${formatMoney(safeCollected)} RWF`,
      icon: DollarSign,
      color: 'emerald',
      trend: null,
    },
    {
      label: 'Interest Collected',
      value: `${formatMoney(safeInterest)} RWF`,
      icon: PiggyBank,
      color: 'green',
      trend: null,
      subtitle: 'Realized profit',
    },
    {
      label: 'Outstanding Principal',
      value: `${formatMoney(safeOutstanding)} RWF`,
      icon: Wallet,
      color: 'amber',
      trend: null,
      subtitle: 'Owed by active loans',
    },
    {
      label: 'Projected Late Fees',
      value: `${formatMoney(safeLateFees)} RWF`,
      icon: AlertTriangle,
      color: 'red',
      trend: null,
      subtitle: 'Accumulated penalties',
    },
    {
      label: 'Net Profit',
      value: `${formatMoney(netProfit)} RWF`,
      icon: TrendingUp,
      color: 'emerald',
      trend: null,
      subtitle: 'Interest + Late Fees',
    },
  ];

  const colorClasses = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Financial Dashboard</h1>
        <p className="text-slate-400">Real-time cooperative financial metrics and KPIs</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          
          return (
            <div
              key={metric.label}
              className="metric-card animate-fade-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Icon & Trend */}
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[metric.color]} rounded-xl flex items-center justify-center shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                {metric.trend && (
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                    metric.trend.startsWith('+') 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    {metric.trend.startsWith('+') ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {metric.trend}
                  </div>
                )}
              </div>

              {/* Label */}
              <p className="text-slate-400 text-sm font-medium mb-1">{metric.label}</p>

              {/* Value */}
              <p className="text-2xl font-bold text-slate-100 mb-1">
                {metric.value}
              </p>

              {/* Subtitle */}
              {metric.subtitle && (
                <p className="text-xs text-slate-500">{metric.subtitle}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Capital Health */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Vault className="w-5 h-5 text-emerald-400" />
            Capital Health
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Savings Pool</span>
              <span className="font-semibold text-slate-200">
                {formatMoney(safeTotalSavings)} RWF
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Capital Deployed (Out on Loan)</span>
              <span className="font-semibold text-slate-200">
                {formatMoney(safeOutstanding)} RWF
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Cash in Vault</span>
              <span className="font-semibold text-emerald-400">
                {formatMoney(cashInVault)} RWF
              </span>
            </div>
            <div className="pt-3 border-t border-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Liquidity Ratio</span>
                <span className={`font-bold ${liquidityRatio < 20 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {liquidityRatio}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Loan Performance */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            Loan Performance
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Disbursed</span>
              <span className="font-semibold text-slate-200">
                {formatMoney(safeLoaned)} RWF
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Recovered</span>
              <span className="font-semibold text-slate-200">
                {formatMoney(safeCollected)} RWF
              </span>
            </div>
            <div className="pt-3 border-t border-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium">Recovery Rate</span>
                <span className="font-bold text-indigo-400">
                  {recoveryRate}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}