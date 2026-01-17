import React, { useState, useEffect } from 'react';
import { accessKeysAPI, serversAPI } from '../api';
import AccessKeyForm from '../components/AccessKeyForm';
import AccessKeyList from '../components/AccessKeyList';
import '../styles/accesskeys.css';

const AccessKeysPage = () => {
  const [keys, setKeys] = useState([]);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [selectedServerId, setSelectedServerId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [keysResponse, serversResponse] = await Promise.all([
        accessKeysAPI.getAll(selectedServerId || undefined),
        serversAPI.getAll(),
      ]);
      setKeys(keysResponse);
      setServers(serversResponse);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = () => {
    setEditingKey(null);
    setShowForm(true);
  };

  const handleEditKey = (key) => {
    setEditingKey(key);
    setShowForm(true);
  };

  const handleDeleteKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to delete this access key?')) return;

    try {
      await accessKeysAPI.delete(keyId);
      setKeys((prev) => prev.filter((k) => k._id !== keyId));
    } catch (err) {
      setError('Failed to delete key');
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editingKey) {
        await accessKeysAPI.update(editingKey._id, formData);
        setKeys((prev) =>
          prev.map((k) => (k._id === editingKey._id ? { ...k, ...formData } : k))
        );
      } else {
        const newKey = await accessKeysAPI.create(formData);
        setKeys((prev) => [...prev, newKey]);
      }
      setShowForm(false);
      setEditingKey(null);
    } catch (err) {
      setError(editingKey ? 'Failed to update key' : 'Failed to create key');
    }
  };

  return (
    <div className="accesskeys-page">
      <div className="page-header">
        <h1>Access Keys Management</h1>
        <button className="btn-primary" onClick={handleAddKey}>
          + Create Key
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filters">
        <select
          value={selectedServerId}
          onChange={(e) => setSelectedServerId(e.target.value)}
          className="filter-select"
        >
          <option value="">All Servers</option>
          {servers.map((server) => (
            <option key={server._id} value={server._id}>
              {server.name} ({server.region})
            </option>
          ))}
        </select>
      </div>

      {showForm && (
        <AccessKeyForm
          key={editingKey?._id}
          keyData={editingKey}
          servers={servers}
          onSubmit={handleFormSubmit}
          onCancel={() => setShowForm(false)}
        />
      )}

      <AccessKeyList
        keys={keys}
        servers={servers}
        loading={loading}
        onEdit={handleEditKey}
        onDelete={handleDeleteKey}
      />
    </div>
  );
};

export default AccessKeysPage;
