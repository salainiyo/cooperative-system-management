import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { tokenManager, api } from './api';
import Login from './components/Login';
import Layout from './components/Layout';
import AdminDashboard from './components/AdminDashboard';
import MemberProfile from './components/MemberProfile';
import MembersDirectory from './components/MembersDirectory';
import { ToastProvider } from './context/ToastContext'; // <-- Import the provider
import './App.css';

function ProtectedRoute({ children }) {
  const isAuthenticated = tokenManager.isAuthenticated();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
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

  return (
    // <-- Wrap everything in ToastProvider
    <ToastProvider> 
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/" element={<ProtectedRoute><Layout user={user} /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="members" element={<MembersDirectory />} />
            <Route path="member/:memberId" element={<MemberProfile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;