import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import Members from './Members';
import Layout from './Layout'; 
import Loans from './Loans';
import Payments from './Payments';
import Profile from './Profile'; // <-- 1. Imported the Profile here!

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('access_token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Page */}
        <Route path="/" element={<Login />} />
        
        {/* Protected Admin Shell */}
        <Route 
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* These pages render INSIDE the Layout's <Outlet /> */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/members" element={<Members />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/member/:id" element={<Profile />} /> {/* <-- 2. The dynamic route! */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;