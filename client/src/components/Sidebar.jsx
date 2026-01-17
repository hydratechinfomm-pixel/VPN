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

        <Link
          to="/servers"
          className={`nav-item ${isActive('/servers') ? 'active' : ''}`}
        >
          🖥️ VPN Servers
        </Link>

        <Link
          to="/access-keys"
          className={`nav-item ${isActive('/access-keys') ? 'active' : ''}`}
        >
          🔑 Access Keys
        </Link>

        {user?.role === 'Admin' && (
          <Link
            to="/users"
            className={`nav-item ${isActive('/users') ? 'active' : ''}`}
          >
            👥 Users
          </Link>
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
