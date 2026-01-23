import React from 'react';

const ServerList = ({ servers, loading, onRefresh }) => {
  if (loading) {
    return <div className="loading">Loading servers...</div>;
  }

  if (!servers || servers.length === 0) {
    return (
      <div className="empty-state">
        <p>No servers configured yet. Go to VPN Servers to add one.</p>
      </div>
    );
  }

  return (
    <div className="server-list">
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Server Name</th>
              <th>Type</th>
              <th>Server Type</th>
              <th>Region</th>
              <th>Provider</th>
              <th>Bandwidth (30d)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => (
              <tr key={server._id}>
                <td>{server.name}</td>
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
                <td>{server.region}</td>
                <td>{server.provider}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ServerList;
