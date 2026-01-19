import React from 'react';

const DashboardStats = ({ stats, loading }) => {
  if (loading) {
    return <div className="stats-container">Loading...</div>;
  }

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

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
        <div className="stat-icon">📱</div>
        <div className="stat-content">
          <h3>{stats.totalDevices || 0}</h3>
          <p>Total Devices</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">🟢</div>
        <div className="stat-content">
          <h3>{stats.onlineDevices || 0}</h3>
          <p>Online Devices</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">📊</div>
        <div className="stat-content">
          <h3>{formatBytes(stats.totalUsage || 0)}</h3>
          <p>Total Usage</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
