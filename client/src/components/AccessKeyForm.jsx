import React, { useState } from 'react';

const AccessKeyForm = ({ keyData, servers, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    serverId: keyData?.serverId || '',
    userId: keyData?.userId || '',
    keyName: keyData?.keyName || '',
    description: keyData?.description || '',
    dataLimit: keyData?.dataLimit || 0,
    expiresAt: keyData?.expiresAt ? new Date(keyData.expiresAt).toISOString().split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'dataLimit' ? parseInt(value) : value,
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
        <h2>{keyData ? 'Edit Access Key' : 'Create New Access Key'}</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="serverId">Server *</label>
              <select
                id="serverId"
                name="serverId"
                value={formData.serverId}
                onChange={handleChange}
                required
              >
                <option value="">Select Server</option>
                {servers.map((server) => (
                  <option key={server._id} value={server._id}>
                    {server.name} ({server.region})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="userId">User ID *</label>
              <input
                type="text"
                id="userId"
                name="userId"
                value={formData.userId}
                onChange={handleChange}
                required
                placeholder="User identifier"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="keyName">Key Name *</label>
            <input
              type="text"
              id="keyName"
              name="keyName"
              value={formData.keyName}
              onChange={handleChange}
              required
              placeholder="e.g., My VPN Key"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter description (optional)"
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dataLimit">Data Limit (GB)</label>
              <input
                type="number"
                id="dataLimit"
                name="dataLimit"
                value={formData.dataLimit}
                onChange={handleChange}
                placeholder="0 for unlimited"
              />
            </div>

            <div className="form-group">
              <label htmlFor="expiresAt">Expiration Date</label>
              <input
                type="date"
                id="expiresAt"
                name="expiresAt"
                value={formData.expiresAt}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : keyData ? 'Update Key' : 'Create Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccessKeyForm;
