import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AccessKeysPage from './pages/AccessKeysPage';
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
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <div className="loading-screen">Loading...</div>;

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (requiredRole) {
    // Case-insensitive role check
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
            path="/access-keys"
            element={
              <ProtectedRoute>
                <AppLayout><AccessKeysPage /></AppLayout>
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

          {/* Admin Routes */}
          <Route
            path="/servers"
            element={
              <ProtectedRoute requiredRole="Admin">
                <AppLayout><ServersPage /></AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/plans"
            element={
              <ProtectedRoute requiredRole="Admin">
                <AppLayout><PlansPage /></AppLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute requiredRole="Admin">
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
