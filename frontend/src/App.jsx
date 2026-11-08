import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from './api';
import { ToastProvider } from './components/ToastProvider';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import MobileNav from './components/MobileNav';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import ExpensesPage from './pages/ExpensesPage';
import AddExpensePage from './pages/AddExpensePage';
import ItemizedExpensePage from './pages/ItemizedExpensePage';
import SettlementsPage from './pages/SettlementsPage';
import GlobalSettlementsPage from './pages/GlobalSettlementsPage';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

function AppLayout() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileSyncComplete, setProfileSyncComplete] = useState(false);

  useEffect(() => {
    let active = true;

    if (!user) {
      setProfile(null);
      setProfileSyncComplete(true);
      return () => { active = false; };
    }

    setProfileSyncComplete(false);

    // Create/sync the backend profile before pages load data that references it.
    api.get('/api/users/me')
      .then((response) => {
        if (active) setProfile(response.data);
      })
      .catch((error) => {
        console.error('Failed to sync user profile', error);
      })
      .finally(() => {
        if (active) setProfileSyncComplete(true);
      });

    return () => { active = false; };
  }, [user?.id]);

  return (
    <ProtectedRoute>
      {!profileSyncComplete ? (
        <div className="app-loading min-h-screen p-8 text-text-muted">Loading your account...</div>
      ) : (
        <div className="app-shell flex min-h-screen">
          <Sidebar />
          <div className="app-content flex-1 ml-60 min-w-0">
            <Navbar />
            <main className="app-main pt-16 p-8">
              <Outlet context={{ profile }} />
            </main>
          </div>
          <MobileNav />
        </div>
      )}
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route path="/groups/:id" element={<GroupDetailPage />} />
              <Route path="/groups/:id/settlements" element={<SettlementsPage />} />
              <Route path="/settlements" element={<GlobalSettlementsPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/add-expense" element={<AddExpensePage />} />
              <Route path="/add-expense/itemized" element={<ItemizedExpensePage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
