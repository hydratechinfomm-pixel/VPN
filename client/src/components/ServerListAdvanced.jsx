import React, { useState } from 'react';

const ServerListAdvanced = ({ servers, loading, onEdit, onDelete, onRefresh, onHealthCheck, onSyncOutline }) => {
  const [checkingHealth, setCheckingHealth] = useState({});
  const [healthStatus, setHealthStatus] = useState({});

  const handleHealthCheck = async (serverId) => {
    setCheckingHealth(prev => ({ ...prev, [serverId]: true }));
    try {
      const result = await onHealthCheck(serverId);
      setHealthStatus(prev => ({
        ...prev,
        [serverId]: {
          healthy: result.isHealthy,
          status: result.status,
          timestamp: new Date(),
        }
      }));
    } catch (error) {
      setHealthStatus(prev => ({
        ...prev,
        [serverId]: {
          healthy: false,
          error: error.message || 'Health check failed',
          timestamp: new Date(),
        }
      }));
    } finally {
      setCheckingHealth(prev => ({ ...prev, [serverId]: false }));
    }
  };

  const getHealthBadge = (server) => {
    const health = healthStatus[server._id];
    if (!health) {
      return <span className="badge unknown">Unknown</span>;
    }
    if (health.healthy) {
      return <span className="badge healthy">✓ Healthy</span>;
    }
    return <span className="badge unhealthy">✗ Unhealthy</span>;
  };

  if (loading) {
    return <div className="loading">Loading servers...</div>;
  }

  if (!servers || servers.length === 0) {
    return (
      <div className="empty-state">
        <p>No servers found. Create one to get started.</p>
      </div>
    );
  }

  return (
    <div className="server-list-advanced">
      <div className="list-actions">
        <button className="btn-secondary" onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Server Name</th>
              <th>VPN Type</th>
              <th>Server Type</th>
              <th>Region</th>
              <th>Provider</th>
              <th>IP Address</th>
              <th>Bandwidth (30d)</th>
              <th>Status</th>
              <th>Health</th>
              <th>Devices</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => (
              <tr key={server._id}>
                <td className="font-bold">{server.name}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: server.vpnType === 'wireguard' ? '#4CAF50' : '#FF9800',
                      color: 'white'
                    }}>
                      {server.vpnType === 'wireguard' ? '🔷 WireGuard' : '🔶 Outline'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      backgroundColor:
                        server.serverType === 'ENTERPRISE' ? '#8B5CF6' :
                        server.serverType === 'PREMIUM' ? '#F59E0B' :
                        '#6B7280',
                      color: 'white'
                    }}>
                      {server.serverType === 'ENTERPRISE' ? '🏢 Enterprise' :
                       server.serverType === 'PREMIUM' ? '💎 Premium' :
                       '🟢 Regular'}
                    </span>
                  </td>
                <td>{server.region || 'N/A'}</td>
                <td>{server.provider || 'Custom'}</td>
                <td className="monospace">{server.host}</td>
                <td>
                  <span style={{ 
                    fontWeight: '600',
                    color: server.bandwidthUsage30Days > 0 ? '#059669' : '#6B7280'
                  }}>
                    {server.bandwidthUsageFormatted || '0 B'}
                  </span>
                  <small style={{ display: 'block', fontSize: '10px', color: '#6B7280', marginTop: '2px' }}>
                    Last 30 days
                  </small>
                </td>
                <td>
                  <span className={`badge ${server.isActive ? 'active' : 'inactive'}`}>
                    {server.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  {getHealthBadge(server)}
                  {healthStatus[server._id]?.status?.isRunning !== undefined && (
                    <div className="health-details">
                      <small>
                        {healthStatus[server._id].status.isRunning ? 'Running' : 'Stopped'} | 
                        Peers: {healthStatus[server._id].status.peerCount || 0}
                      </small>
                    </div>
                  )}
                </td>
                <td>{server.devices?.length || 0}</td>
                <td className="actions">
                  <button
                    className="btn-small btn-success"
                    onClick={() => handleHealthCheck(server._id)}
                    disabled={checkingHealth[server._id]}
                    title="Health Check"
                  >
                    {checkingHealth[server._id] ? '⏳ Checking...' : '🏥 Health Check'}
                  </button>
                  {server.vpnType === 'outline' && (
                    <button
                      className="btn-small btn-info"
                      onClick={() => onSyncOutline(server._id)}
                      title="Sync Access Keys from Server"
                    >
                      ↻ Sync
                    </button>
                  )}
                  <button
                    className="btn-small btn-primary"
                    onClick={() => onEdit(server)}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    className="btn-small btn-danger"
                    onClick={() => onDelete(server._id)}
                  >
                    🗑️ Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>  
  );
};

export default ServerListAdvanced;
