import React from 'react';

const DashboardStats = ({ stats, loading }) => {
  if (loading) {
    return <div className="stats-container">Loading...</div>;
  }

  return (
    <div className="stats-container">
      <div className="stat-card">
        <div className="stat-icon">🖥️</div>
        <div className="stat-content">
          <h3>{stats.totalServers}</h3>
          <p>Total Servers</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">✅</div>
        <div className="stat-content">
          <h3>{stats.activeServers}</h3>
          <p>Active Servers</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">🔑</div>
        <div className="stat-content">
          <h3>{stats.totalKeys}</h3>
          <p>Total Access Keys</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
