import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  HandCoins,
  Lock,
  Mail,
  PiggyBank,
  ShieldCheck,
  Users,
} from 'lucide-react';

const FEATURES = [
  {
    icon: PiggyBank,
    title: 'Member savings',
    text: 'Deposits, withdrawals and a running balance for every member, always in agreement with the books.',
  },
  {
    icon: HandCoins,
    title: 'Loans & repayments',
    text: 'Requests, approvals, disbursements and installments — interest and late fees computed for you.',
  },
  {
    icon: BarChart3,
    title: 'Reports & exports',
    text: 'Portfolio, collections and member statements you can print or export to CSV in one click.',
  },
  {
    icon: Users,
    title: 'Self-service portal',
    text: 'Members request loans and withdrawals online; you review, approve or decline from one queue.',
  },
];

export default function Login({ setUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.login(email, password);
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Product story — what the system does */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 xl:p-14 border-r border-white/5 bg-gradient-to-br from-indigo-950/80 via-slate-950 to-slate-900">
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at top, black, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at top, black, transparent 70%)',
          }}
        ></div>
        <div className="absolute -top-24 -left-16 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Brand */}
        <div className="relative flex items-center gap-3 animate-fade-in">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white text-xl font-bold">
            I
          </div>
          <div>
            <p className="text-slate-100 font-semibold leading-tight">Ikimina Cooperative</p>
            <p className="text-xs text-slate-400">Financial management system</p>
          </div>
        </div>

        {/* Headline + features */}
        <div className="relative max-w-xl py-10 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-widest text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1.5">
            Savings · Loans · Members
          </span>
          <h1 className="mt-5 text-4xl xl:text-[2.75rem] xl:leading-[1.15] font-bold text-white">
            Run the whole cooperative from one trusted ledger.
          </h1>
          <p className="mt-4 text-slate-400 leading-relaxed">
            This system keeps member savings, loan repayments and the cooperative's books in
            one auditable place — so balances always agree, reports take seconds, and members
            can serve themselves instead of queuing at the office.
          </p>

          <ul className="mt-9 space-y-5">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-slate-900/80 border border-white/10 flex items-center justify-center">
                  <Icon className="text-indigo-300" size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{title}</p>
                  <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Trust footer */}
        <div className="relative flex items-center gap-6 text-xs text-slate-500 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Role-based access
          </span>
          <span>Encrypted sessions</span>
          <span>Hosted on your cooperative's own server</span>
        </div>
      </aside>

      {/* Sign-in form */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8 animate-fade-in">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-lg font-bold">
              I
            </div>
            <div>
              <p className="text-slate-100 font-semibold leading-tight">Ikimina Cooperative</p>
              <p className="text-xs text-slate-400">Financial management system</p>
            </div>
          </div>

          <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.05s' }}>
            <h2 className="text-2xl font-bold text-slate-100">Welcome back</h2>
            <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
              Sign in to manage savings, loans, reports and member portal access.
            </p>
          </div>

          <div
            className="glass-effect rounded-2xl p-6 sm:p-7 shadow-2xl animate-fade-in"
            style={{ animationDelay: '0.1s' }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg animate-fade-in"
                >
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input pl-10"
                    placeholder="admin@cooperative.rw"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input pl-10 pr-11"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <Link to="/forgot-password" className="text-sm text-indigo-400 hover:text-indigo-300">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3 text-base font-semibold"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Sign In <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-slate-500 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Need help? Contact your system administrator
          </p>
        </div>
      </main>
    </div>
  );
}
