import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <aside className="sidebar">
      <nav className="nav-menu">
        <Link
          to="/dashboard"
          className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
        >
          📊 Dashboard
        </Link>

        {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'moderator') && (
          <Link
            to="/servers"
            className={`nav-item ${isActive('/servers') ? 'active' : ''}`}
          >
            🖥️ VPN Servers
          </Link>
        )}

        <Link
          to="/devices"
          className={`nav-item ${isActive('/devices') ? 'active' : ''}`}
        >
          📱 Devices
        </Link>

        {(user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'moderator') && (
          <>
            <Link
              to="/plans"
              className={`nav-item ${isActive('/plans') ? 'active' : ''}`}
            >
              💳 Plans
            </Link>
            <Link
              to="/users"
              className={`nav-item ${isActive('/users') ? 'active' : ''}`}
            >
              👥 Users
            </Link>
          </>
        )}

        <Link
          to="/profile"
          className={`nav-item ${isActive('/profile') ? 'active' : ''}`}
        >
          👤 Profile
        </Link>
      </nav>
    </aside>
  );
};

export default Sidebar;
