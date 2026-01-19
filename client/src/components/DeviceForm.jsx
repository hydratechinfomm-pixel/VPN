import React, { useState } from 'react';

const DeviceForm = ({ deviceData, servers, plans, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    serverId: deviceData?.server?._id || deviceData?.server || '',
    planId: deviceData?.plan?._id || deviceData?.plan || '',
    name: deviceData?.name || '',
    dataLimit: deviceData?.dataLimit?.bytes ? (deviceData.dataLimit.bytes / (1024 * 1024 * 1024)).toFixed(2) : '',
    expiresAt: deviceData?.expiresAt ? new Date(deviceData.expiresAt).toISOString().split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        dataLimit: formData.dataLimit ? Math.round(parseFloat(formData.dataLimit) * 1024 * 1024 * 1024) : null,
      };
      await onSubmit(submitData);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{deviceData ? 'Edit Device' : 'Add New Device'}</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Device Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., iPhone, Laptop, etc."
            />
          </div>

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
              <label htmlFor="planId">Plan (Optional)</label>
              <select
                id="planId"
                name="planId"
                value={formData.planId}
                onChange={handleChange}
              >
                <option value="">No Plan</option>
                {plans.map((plan) => (
                  <option key={plan._id} value={plan._id}>
                    {plan.name} {plan.dataLimit?.isUnlimited ? '(Unlimited)' : `(${plan.dataLimitGB} GB)`}
                  </option>
                ))}
              </select>
            </div>
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
                min="0"
                step="0.01"
                placeholder="Leave empty for unlimited"
              />
              <small>Leave empty for unlimited data</small>
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
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : deviceData ? 'Update Device' : 'Create Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeviceForm;
