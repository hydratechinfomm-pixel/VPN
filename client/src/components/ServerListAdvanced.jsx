import React from 'react';

const ServerListAdvanced = ({ servers, loading, onEdit, onDelete, onRefresh }) => {
  if (loading) {
    return <div className="loading">Loading servers...</div>;
  }

  if (servers.length === 0) {
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

      <table className="table">
        <thead>
          <tr>
            <th>Server Name</th>
            <th>Region</th>
            <th>Provider</th>
            <th>IP Address</th>
            <th>Status</th>
            <th>Keys</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr key={server._id}>
              <td className="font-bold">{server.name}</td>
              <td>{server.region}</td>
              <td>{server.provider}</td>
              <td className="monospace">{server.ipAddress}</td>
              <td>
                <span className={`badge ${server.isActive ? 'active' : 'inactive'}`}>
                  {server.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{server.accessKeys?.length || 0}</td>
              <td className="actions">
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
  );
};

export default ServerListAdvanced;
