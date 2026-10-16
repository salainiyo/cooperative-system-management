import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Wallet, HandCoins, ClipboardList, KeyRound, LogOut, Menu, X } from 'lucide-react';
import { api } from '../api';
import { useConfirm } from './ui/ConfirmDialog';

export default function MemberLayout({ user }) {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const handleLogout = async () => {
    if (await confirm('Are you sure you want to log out?', { confirmLabel: 'Sign out' })) {
      await api.logout();
    }
  };

  const navItems = [
    { path: '/account', icon: Wallet, label: 'My Account' },
    { path: '/loans', icon: HandCoins, label: 'My Loans' },
    { path: '/request-loan', icon: ClipboardList, label: 'Request a Loan' },
    { path: '/my-requests', icon: ClipboardList, label: 'My Requests' },
    { path: '/change-password', icon: KeyRound, label: 'Change Password' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      {/* Mobile bar */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">I</span>
          </div>
          <h1 className="text-white font-bold">Member Portal</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-400 hover:text-white">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">I</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Ikimina</h1>
              <p className="text-slate-400 text-xs">Member Portal</p>
            </div>
          </div>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-3">
          {user && (
            <div className="px-4 py-3 bg-slate-800 rounded-lg">
              <p className="text-slate-400 text-xs mb-1">Signed in as</p>
              <p className="text-slate-200 font-medium text-sm truncate">{user.email}</p>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-ghost w-full justify-start gap-3">
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950">
          <Outlet />
        </main>
      </div>
      {confirmDialog}
    </div>
  );
}
