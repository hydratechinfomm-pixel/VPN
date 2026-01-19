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
            <th>Region</th>
            <th>Provider</th>
            <th>Status</th>
            <th>Access Keys</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr key={server._id}>
              <td>{server.name}</td>
              <td>{server.region}</td>
              <td>{server.provider}</td>
              <td>
                <span className={`badge ${server.isActive ? 'active' : 'inactive'}`}>
                  {server.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{server.accessKeys?.length || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ServerList;
