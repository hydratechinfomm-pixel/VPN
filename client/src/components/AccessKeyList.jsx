import React, { useState } from 'react';

const AccessKeyList = ({ keys, servers, loading, onEdit, onDelete }) => {
  const [expandedKey, setExpandedKey] = useState(null);

  if (loading) {
    return <div className="loading">Loading access keys...</div>;
  }

  if (keys.length === 0) {
    return (
      <div className="empty-state">
        <p>No access keys found. Create one to get started.</p>
      </div>
    );
  }

  const getServerName = (serverId) => {
    const server = servers.find((s) => s._id === serverId);
    return server ? server.name : 'Unknown';
  };

  return (
    <div className="accesskey-list">
      <table className="table">
        <thead>
          <tr>
            <th>Key Name</th>
            <th>Server</th>
            <th>User</th>
            <th>Status</th>
            <th>Data Used</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <React.Fragment key={key._id}>
              <tr>
                <td className="font-bold">{key.keyName}</td>
                <td>{getServerName(key.serverId)}</td>
                <td className="monospace">{key.userId}</td>
                <td>
                  <span className={`badge ${key.status === 'active' ? 'active' : 'inactive'}`}>
                    {key.status}
                  </span>
                </td>
                <td>{key.dataUsed || 0} MB</td>
                <td>{key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}</td>
                <td className="actions">
                  <button className="btn-small btn-secondary" onClick={() => setExpandedKey(expandedKey === key._id ? null : key._id)}>
                    📋 Details
                  </button>
                  <button className="btn-small btn-primary" onClick={() => onEdit(key)}>
                    ✏️ Edit
                  </button>
                  <button className="btn-small btn-danger" onClick={() => onDelete(key._id)}>
                    🗑️ Delete
                  </button>
                </td>
              </tr>
              {expandedKey === key._id && (
                <tr className="expanded-row">
                  <td colSpan="7">
                    <div className="key-details">
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="label">Access Key:</span>
                          <code className="value">{key.accessKey}</code>
                        </div>
                        <div className="detail-item">
                          <span className="label">Description:</span>
                          <span className="value">{key.description || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Data Limit:</span>
                          <span className="value">{key.dataLimit || 'Unlimited'} GB</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Created At:</span>
                          <span className="value">{new Date(key.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AccessKeyList;
