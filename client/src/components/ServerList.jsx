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
      <table className="table">
        <thead>
          <tr>
            <th>Server Name</th>
            <th>Type</th>
            <th>Region</th>
            <th>Provider</th>
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
              <td>{server.region}</td>
              <td>{server.provider}</td>
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
  );
};

export default ServerList;
