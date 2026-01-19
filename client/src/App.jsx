import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import DevicesPage from './pages/DevicesPage';
import PlansPage from './pages/PlansPage';
import ServersPage from './pages/ServersPage';
import UsersPage from './pages/UsersPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';

// Styles
import './styles/global.css';

// Protected route wrapper
const ProtectedRoute = ({ children, requiredRole, requiredPanelAdmin }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <div className="loading-screen">Loading...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (requiredPanelAdmin) {
    const userRole = user?.role?.toLowerCase();
    if (userRole !== 'admin' && userRole !== 'moderator') {
      return <Navigate to="/dashboard" />;
    }
  } else if (requiredRole) {
    const userRole = user?.role?.toLowerCase();
    const requiredRoleLower = requiredRole.toLowerCase();
    if (userRole !== requiredRoleLower) {
      return <Navigate to="/dashboard" />;
    }
  }

  return children;
};

// App layout wrapper
const AppLayout = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return children;
  }

  return (
    <div className="app-layout">
      <Header />
      <div className="app-container">
        <Sidebar />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<AppLayout><LoginPage /></AppLayout>} />
          <Route path="/register" element={<AppLayout><RegisterPage /></AppLayout>} />

          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout><DashboardPage /></AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/devices"
            element={
              <ProtectedRoute>
                <AppLayout><DevicesPage /></AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <AppLayout><ProfilePage /></AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Panel admin or staff: Servers, Plans, Users */}
          <Route
            path="/servers"
            element={
              <ProtectedRoute requiredPanelAdmin>
                <AppLayout><ServersPage /></AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/plans"
            element={
              <ProtectedRoute requiredPanelAdmin>
                <AppLayout><PlansPage /></AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute requiredPanelAdmin>
                <AppLayout><UsersPage /></AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Default & Not Found */}
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<AppLayout><NotFoundPage /></AppLayout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
