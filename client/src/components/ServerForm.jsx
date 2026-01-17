import React, { useState } from 'react';

const ServerForm = ({ server, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: server?.name || '',
    region: server?.region || '',
    provider: server?.provider || 'Outline',
    ipAddress: server?.ipAddress || '',
    port: server?.port || 8088,
    apiUrl: server?.apiUrl || '',
    apiKey: server?.apiKey || '',
    maxKeys: server?.maxKeys || 100,
    isActive: server?.isActive !== false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{server ? 'Edit Server' : 'Create New Server'}</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Server Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., Singapore Server 1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="region">Region *</label>
              <select
                id="region"
                name="region"
                value={formData.region}
                onChange={handleChange}
                required
              >
                <option value="">Select Region</option>
                <option value="Singapore">Singapore</option>
                <option value="US-East">US-East</option>
                <option value="US-West">US-West</option>
                <option value="Europe">Europe</option>
                <option value="Asia">Asia</option>
                <option value="Australia">Australia</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="provider">Provider</label>
              <input
                type="text"
                id="provider"
                name="provider"
                value={formData.provider}
                onChange={handleChange}
                placeholder="e.g., Outline"
              />
            </div>

            <div className="form-group">
              <label htmlFor="ipAddress">IP Address *</label>
              <input
                type="text"
                id="ipAddress"
                name="ipAddress"
                value={formData.ipAddress}
                onChange={handleChange}
                required
                placeholder="e.g., 192.168.1.1"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="port">Port</label>
              <input
                type="number"
                id="port"
                name="port"
                value={formData.port}
                onChange={handleChange}
                placeholder="8088"
              />
            </div>

            <div className="form-group">
              <label htmlFor="maxKeys">Max Keys</label>
              <input
                type="number"
                id="maxKeys"
                name="maxKeys"
                value={formData.maxKeys}
                onChange={handleChange}
                placeholder="100"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="apiUrl">API URL *</label>
            <input
              type="url"
              id="apiUrl"
              name="apiUrl"
              value={formData.apiUrl}
              onChange={handleChange}
              required
              placeholder="https://example.com/api"
            />
          </div>

          <div className="form-group">
            <label htmlFor="apiKey">API Key *</label>
            <textarea
              id="apiKey"
              name="apiKey"
              value={formData.apiKey}
              onChange={handleChange}
              required
              placeholder="Paste your Outline API key"
              rows="3"
            />
          </div>

          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
            />
            <label htmlFor="isActive">Active</label>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : server ? 'Update Server' : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServerForm;
