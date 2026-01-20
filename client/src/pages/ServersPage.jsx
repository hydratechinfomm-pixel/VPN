import React, { useState, useEffect } from 'react';
import { serversAPI } from '../api';
import ServerForm from '../components/ServerForm';
import ServerListAdvanced from '../components/ServerListAdvanced';
import '../styles/servers.css';

const ServersPage = () => {
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingServer, setEditingServer] = useState(null);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      setLoading(true);
      const response = await serversAPI.getAll();
      const serversList = Array.isArray(response) ? response : response?.servers || [];
      setServers(serversList);
    } catch (err) {
      setError('Failed to load servers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddServer = () => {
    setEditingServer(null);
    setShowForm(true);
  };

  const handleEditServer = (server) => {
    setEditingServer(server);
    setShowForm(true);
  };

  const handleDeleteServer = async (serverId) => {
    if (!window.confirm('Are you sure you want to delete this server?')) return;

    try {
      await serversAPI.delete(serverId);
      setServers((prev) => prev.filter((s) => s._id !== serverId));
    } catch (err) {
      setError('Failed to delete server');
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editingServer) {
        await serversAPI.update(editingServer._id, formData);
        setServers((prev) =>
          prev.map((s) => (s._id === editingServer._id ? { ...s, ...formData } : s))
        );
      } else {
        const response = await serversAPI.create(formData);
        const newServer = response.server || response;
        setServers((prev) => [...prev, newServer]);
      }
      setShowForm(false);
      setEditingServer(null);
      fetchServers(); // Refresh to get updated data
    } catch (err) {
      setError(editingServer ? 'Failed to update server' : 'Failed to create server');
      console.error(err);
    }
  };

  const handleHealthCheck = async (serverId) => {
    try {
      const result = await serversAPI.healthCheck(serverId);
      // Update server health status in the list
      setServers((prev) =>
        prev.map((s) =>
          s._id === serverId
            ? {
                ...s,
                stats: {
                  ...s.stats,
                  isHealthy: result.isHealthy,
                  lastHealthCheck: new Date(),
                },
              }
            : s
        )
      );
      return result;
    } catch (err) {
      console.error('Health check error:', err);
      throw err;
    }
  };

  const handleSyncOutline = async (serverId) => {
    try {
      const response = await serversAPI.syncOutline(serverId);
      setError('');
      alert(`✅ Synced! Imported ${response.synced} new access keys. Skipped ${response.skipped} existing keys.`);
      fetchServers();
    } catch (err) {
      setError(`Sync failed: ${err.response?.data?.error || err.message}`);
      console.error(err);
    }
  };

  return (
    <div className="servers-page">
      <div className="page-header">
        <h1>VPN Servers Management</h1>
        <button className="btn-primary" onClick={handleAddServer}>
          + Add Server
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showForm && (
        <ServerForm
          server={editingServer}
          onSubmit={handleFormSubmit}
          onCancel={() => setShowForm(false)}
        />
      )}

      <ServerListAdvanced
        servers={servers}
        loading={loading}
        onEdit={handleEditServer}
        onDelete={handleDeleteServer}
        onRefresh={fetchServers}
        onHealthCheck={handleHealthCheck}
        onSyncOutline={handleSyncOutline}
      />
    </div>
  );
};

export default ServersPage;
