import React from 'react';

const Header = () => {
  const { user, logout } = require('../context/AuthContext').useAuth();
  const navigate = require('react-router-dom').useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="logo">Outline VPN</h1>
        </div>
        <div className="header-right">
          <div className="user-menu">
            <span className="user-name">{user?.name}</span>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
