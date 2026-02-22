import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Wallet, Banknote, CreditCard } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/');
  };

  // NavLink automatically applies an "active" class when we are on that page!
  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${
      isActive 
        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
        : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
    }`;

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      
      {/* LEFT SIDEBAR */}
      <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col">
        {/* Logo Area */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 mb-6">
          <Wallet className="text-indigo-500 mr-2" size={24} />
          <span className="text-xl font-bold text-white tracking-tight">CoopManager</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 space-y-2">
          <NavLink to="/dashboard" className={navLinkClass}>
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>
          
          <NavLink to="/members" className={navLinkClass}>
            <Users size={20} />
            Members
          </NavLink>
          <NavLink to="/loans" className={navLinkClass}>
            <Banknote size={20} />
            Loans
          </NavLink>
          <NavLink to="/payments" className={navLinkClass}>
            <CreditCard size={20} />
            Payments
          </NavLink>
        </nav>

        {/* User / Logout Area */}
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors font-medium"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* RIGHT MAIN CONTENT AREA (The Outlet) */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        <Outlet />
      </main>

    </div>
  );
}