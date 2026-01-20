import React, { useState } from 'react';

const DashboardStats = ({ stats, loading, servers = [] }) => {
  const [vpnTypeFilter, setVpnTypeFilter] = useState('all'); // 'all', 'wireguard', 'outline'

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

  // Filter stats by VPN type if needed
  const getFilteredStats = () => {
    if (vpnTypeFilter === 'all') {
      return stats;
    }

    // Count servers of the selected type
    const filteredServers = servers.filter((s) => s.vpnType === vpnTypeFilter);
    const wireguardCount = vpnTypeFilter === 'wireguard' ? filteredServers.length : 0;
    const outlineCount = vpnTypeFilter === 'outline' ? filteredServers.length : 0;

    return {
      ...stats,
      totalServers: filteredServers.length,
      activeServers: filteredServers.filter((s) => s.isActive).length,
      // These would need more granular data to filter by type
      wireguardServers: servers.filter((s) => s.vpnType === 'wireguard').length,
      outlineServers: servers.filter((s) => s.vpnType === 'outline').length,
    };
  };

  const filteredStats = getFilteredStats();

  return (
    <>
      {/* VPN Type Filter */}
      <div className="stats-filter">
        <label htmlFor="vpnTypeFilter">Filter by VPN Type:</label>
        <select
          id="vpnTypeFilter"
          value={vpnTypeFilter}
          onChange={(e) => setVpnTypeFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All VPN Types</option>
          <option value="wireguard">WireGuard Only</option>
          <option value="outline">Outline Only</option>
        </select>
      </div>

      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-icon">🖥️</div>
          <div className="stat-content">
            <h3>{filteredStats.totalServers}</h3>
            <p>Total Servers</p>
            {vpnTypeFilter === 'all' && (
              <small>
                🔵 WireGuard: {filteredStats.wireguardServers} | 🟠 Outline:{' '}
                {filteredStats.outlineServers}
              </small>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>{filteredStats.activeServers}</h3>
            <p>Active Servers</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📱</div>
          <div className="stat-content">
            <h3>{filteredStats.totalDevices || 0}</h3>
            <p>Total Devices/Keys</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <h3>{filteredStats.onlineDevices || 0}</h3>
            <p>Online Devices</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{formatBytes(filteredStats.totalUsage || 0)}</h3>
            <p>Total Usage</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardStats;
