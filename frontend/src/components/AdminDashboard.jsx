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
  Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { api } from '../api';
import InfoTip from './ui/InfoTip';
import { KPI_DEFINITIONS } from '../content/kpiDefinitions';
import { formatMoney } from '../utils/format';


function TrendBadge({ value }) {
  if (value === null || value === undefined) return null;
  const positive = value >= 0;
  return (
    <div
      title="Change over the last 30 days vs the previous 30 days"
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
        positive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
      }`}
    >
      {positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {positive ? '+' : ''}
      {value}%
    </div>
  );
}

function KpiCard({ metric, colorClasses, index }) {
  const Icon = metric.icon;
  const def = KPI_DEFINITIONS[metric.defKey];
  return (
    <div className="metric-card animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[metric.color]} rounded-xl flex items-center justify-center shadow-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <TrendBadge value={metric.trend} />
          {def && <InfoTip title={def.title}>{def.body}</InfoTip>}
        </div>
      </div>
      <p className="text-slate-400 text-sm font-medium mb-1">{metric.label}</p>
      <p className="text-2xl font-bold text-slate-100 mb-1">{metric.value}</p>
      {metric.subtitle && <p className="text-xs text-slate-500">{metric.subtitle}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [deltas, setDeltas] = useState({});
  const [timeseries, setTimeseries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [statsData, deltaData, seriesData] = await Promise.all([
        api.getDashboardStats(),
        api.getPeriodDeltas().catch(() => ({})),
        api.getTimeseries(12).catch(() => []),
      ]);
      setStats(statsData);
      setDeltas(deltaData || {});
      setTimeseries(seriesData || []);
      setError(null);
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
          <button onClick={loadDashboard} className="btn btn-primary mt-4">Retry</button>
        </div>
      </div>
    );
  }

  const safeTotalSavings = parseFloat(stats.total_savings || 0);
  const safeOutstanding = parseFloat(stats.outstanding_principal || 0);
  const safeInterest = parseFloat(stats.total_interest_collected || 0);
  const safeLateFees = parseFloat(stats.projected_late_fees || 0);
  const safeLoaned = parseFloat(stats.total_principal_loaned || 0);
  const safeCollected = parseFloat(stats.total_principal_collected || 0);

  const netProfit = safeInterest + safeLateFees;
  const cashInVault = Math.max(0, safeTotalSavings - safeOutstanding);
  const liquidityRatio =
    safeTotalSavings > 0 ? ((cashInVault / safeTotalSavings) * 100).toFixed(1) : 0;
  const recoveryRate = safeLoaned > 0 ? ((safeCollected / safeLoaned) * 100).toFixed(1) : 0;

  const metrics = [
    {
      label: 'Total Members',
      value: stats.total_members,
      icon: Users,
      color: 'indigo',
      defKey: 'total_members',
      trend: deltas.members_pct,
    },
    {
      label: 'Vault Balance',
      value: `${formatMoney(safeTotalSavings)} RWF`,
      icon: Vault,
      color: 'emerald',
      defKey: 'vault_balance',
      trend: deltas.savings_deposits_pct,
      subtitle: 'Net member savings',
    },
    {
      label: 'Loans Issued',
      value: stats.total_loans_issued_count,
      icon: TrendingUp,
      color: 'blue',
      defKey: 'loans_issued',
      trend: deltas.loans_issued_pct,
      subtitle: `${formatMoney(safeLoaned)} RWF total`,
    },
    {
      label: 'Principal Collected',
      value: `${formatMoney(safeCollected)} RWF`,
      icon: DollarSign,
      color: 'emerald',
      defKey: 'principal_collected',
      trend: deltas.principal_collected_pct,
    },
    {
      label: 'Interest Collected',
      value: `${formatMoney(safeInterest)} RWF`,
      icon: PiggyBank,
      color: 'green',
      defKey: 'interest_collected',
      trend: deltas.interest_collected_pct,
      subtitle: 'Realised profit',
    },
    {
      label: 'Outstanding Principal',
      value: `${formatMoney(safeOutstanding)} RWF`,
      icon: Wallet,
      color: 'amber',
      defKey: 'outstanding_principal',
      trend: null,
      subtitle: 'Owed by active loans',
    },
    {
      label: 'Projected Late Fees',
      value: `${formatMoney(safeLateFees)} RWF`,
      icon: AlertTriangle,
      color: 'red',
      defKey: 'projected_late_fees',
      trend: null,
      subtitle: 'Accumulated penalties',
    },
    {
      label: 'Net Profit',
      value: `${formatMoney(netProfit)} RWF`,
      icon: TrendingUp,
      color: 'emerald',
      defKey: 'net_profit',
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

  const chartData = timeseries.map((point) => ({
    ...point,
    deposits: parseFloat(point.deposits || 0),
    withdrawals: parseFloat(point.withdrawals || 0),
    principal_disbursed: parseFloat(point.principal_disbursed || 0),
    principal_collected: parseFloat(point.principal_collected || 0),
    interest_collected: parseFloat(point.interest_collected || 0),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-100 mb-2">Financial Dashboard</h1>
        <p className="text-slate-400">Real-time cooperative financial metrics and KPIs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <KpiCard key={metric.label} metric={metric} colorClasses={colorClasses} index={index} />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Vault className="w-5 h-5 text-emerald-400" />
            Savings Growth
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="depositsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => formatMoney(v)} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0' }}
                formatter={(value, name) => [`${formatMoney(value)} RWF`, name === 'deposits' ? 'Deposits' : 'Withdrawals']}
              />
              <Area type="monotone" dataKey="deposits" stroke="#10b981" fill="url(#depositsFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="withdrawals" stroke="#ef4444" fill="none" strokeWidth={2} strokeDasharray="4 4" />
              <Legend formatter={(value) => (value === 'deposits' ? 'Deposits' : 'Withdrawals')} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            Disbursed vs Collected
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => formatMoney(v)} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0' }}
                formatter={(value, name) => [
                  `${formatMoney(value)} RWF`,
                  name === 'principal_disbursed' ? 'Disbursed' : 'Collected',
                ]}
              />
              <Bar dataKey="principal_disbursed" fill="#6366f1" radius={[6, 6, 0, 0]} />
              <Bar dataKey="principal_collected" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Legend formatter={(value) => (value === 'principal_disbursed' ? 'Disbursed' : 'Collected')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <Vault className="w-5 h-5 text-emerald-400" />
            Capital Health
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Total Savings Pool</span>
              <span className="font-semibold text-slate-200">{formatMoney(safeTotalSavings)} RWF</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Capital Deployed (Out on Loan)</span>
              <span className="font-semibold text-slate-200">{formatMoney(safeOutstanding)} RWF</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1">
                Cash in Vault
                <InfoTip title={KPI_DEFINITIONS.cash_in_vault.title}>
                  {KPI_DEFINITIONS.cash_in_vault.body}
                </InfoTip>
              </span>
              <span className="font-semibold text-emerald-400">{formatMoney(cashInVault)} RWF</span>
            </div>
            <div className="pt-3 border-t border-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  Liquidity Ratio
                  <InfoTip title={KPI_DEFINITIONS.liquidity_ratio.title}>
                    {KPI_DEFINITIONS.liquidity_ratio.body}
                  </InfoTip>
                </span>
                <span className={`font-bold ${liquidityRatio < 20 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {liquidityRatio}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-400" />
            Loan Performance
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1">
                Total Disbursed
                <InfoTip title={KPI_DEFINITIONS.total_disbursed.title}>
                  {KPI_DEFINITIONS.total_disbursed.body}
                </InfoTip>
              </span>
              <span className="font-semibold text-slate-200">{formatMoney(safeLoaned)} RWF</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 flex items-center gap-1">
                Total Recovered
                <InfoTip title={KPI_DEFINITIONS.total_recovered.title}>
                  {KPI_DEFINITIONS.total_recovered.body}
                </InfoTip>
              </span>
              <span className="font-semibold text-slate-200">{formatMoney(safeCollected)} RWF</span>
            </div>
            <div className="pt-3 border-t border-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-medium flex items-center gap-1">
                  Recovery Rate
                  <InfoTip title={KPI_DEFINITIONS.recovery_rate.title}>
                    {KPI_DEFINITIONS.recovery_rate.body}
                  </InfoTip>
                </span>
                <span className="font-bold text-indigo-400">{recoveryRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
