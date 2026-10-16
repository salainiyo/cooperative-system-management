import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, Suspense, lazy } from 'react';
import { tokenManager, api } from './api';
import Login from './components/Login';
import Layout from './components/Layout';
import MemberLayout from './components/MemberLayout';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './components/NotFound';
import { ToastProvider } from './context/ToastContext';
import './App.css';

const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const MemberProfile = lazy(() => import('./components/MemberProfile'));
const MembersDirectory = lazy(() => import('./components/MembersDirectory'));
const CollectionsReport = lazy(() => import('./components/CollectionsReport'));
const AllLoansPage = lazy(() => import('./components/AllLoansPage'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const LoanRequestsQueue = lazy(() => import('./components/LoanRequestsQueue'));
const ForgotPassword = lazy(() => import('./components/ForgotPassword'));
const ResetPassword = lazy(() => import('./components/ResetPassword'));
const ChangePassword = lazy(() => import('./components/ChangePassword'));
const MemberAccount = lazy(() => import('./components/MemberAccount'));
const MyLoans = lazy(() => import('./components/MyLoans'));
const RequestLoan = lazy(() => import('./components/RequestLoan'));
const LoanRequests = lazy(() => import('./components/LoanRequests'));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-slate-400 text-lg">Loading...</div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const isAuthenticated = tokenManager.isAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (tokenManager.isAuthenticated()) {
        try {
          const currentUser = await api.getCurrentUser();
          setUser(currentUser);
        } catch (error) {
          console.error('Auth check failed:', error);
          tokenManager.clearTokens();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading...</div>
      </div>
    );
  }

  const isAdmin = !!user?.is_admin;
  const isMember = !!user && !user.is_admin && !!user.member_id;

  return (
    <ErrorBoundary>
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Member without a linked profile */}
          <Route
            path="/no-profile"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                  <div className="text-center max-w-md">
                    <h1 className="text-2xl font-bold text-slate-100 mb-3">No member profile linked</h1>
                    <p className="text-slate-400 mb-6">
                      Your account exists but isn't linked to a cooperative member record yet.
                      Please visit the cooperative office.
                    </p>
                    <button onClick={() => api.logout()} className="btn btn-ghost">Sign out</button>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />

          {/* ADMIN PORTAL */}
          {isAdmin && (
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout user={user} />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="members" element={<MembersDirectory />} />
              <Route path="collections" element={<CollectionsReport />} />
              <Route path="loans" element={<AllLoansPage />} />
              <Route path="member/:memberId" element={<MemberProfile />} />
              <Route path="loan-requests" element={<LoanRequestsQueue />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="change-password" element={<ChangePassword />} />
              <Route path="account" element={<Navigate to="/" replace />} />
            </Route>
          )}

          {/* MEMBER PORTAL */}
          {isMember && (
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MemberLayout user={user} />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/account" replace />} />
              <Route path="account" element={<MemberAccount />} />
              <Route path="loans" element={<MyLoans />} />
              <Route path="request-loan" element={<RequestLoan />} />
              <Route path="my-requests" element={<LoanRequests />} />
              <Route path="change-password" element={<ChangePassword />} />
            </Route>
          )}

          {/* Logged-in but neither admin nor linked member */}
          {!!user && !isAdmin && !isMember && (
            <Route path="*" element={<Navigate to="/no-profile" replace />} />
          )}

          {/* Not logged in */}
          {!user && <Route path="*" element={<Navigate to="/login" replace />} />}

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
