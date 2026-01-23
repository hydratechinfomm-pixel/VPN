import React, { useState, useEffect } from 'react';

const DeviceForm = ({ deviceData, servers, plans, users = [], user, onSubmit, onCancel }) => {
  // Convert bytes to GB or MB for display
  const getInitialDataLimit = () => {
    if (!deviceData?.dataLimit?.bytes) return { value: '', unit: 'GB' };
    const bytes = deviceData.dataLimit.bytes;
    const gb = bytes / (1024 * 1024 * 1024);
    const mb = bytes / (1024 * 1024);
    
    // If it's a whole number of GB (or close to it), use GB, otherwise use MB
    if (gb >= 1 && Math.abs(gb - Math.round(gb)) < 0.01) {
      return { value: gb.toFixed(2), unit: 'GB' };
    } else {
      return { value: mb.toFixed(2), unit: 'MB' };
    }
  };
  
  const initialLimit = getInitialDataLimit();
  
  const [formData, setFormData] = useState({
    serverId: deviceData?.server?._id || deviceData?.server || '',
    planId: deviceData?.plan?._id || deviceData?.plan || '',
    userId: deviceData?.user?._id || deviceData?.user || '',
    name: deviceData?.name || '',
    dataLimit: initialLimit.value,
    dataLimitUnit: initialLimit.unit,
    expiresAt: deviceData?.expiresAt ? new Date(deviceData.expiresAt).toISOString().split('T')[0] : '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showWarning, setShowWarning] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(null);

  // Filter servers based on user role (Staff can only see assigned servers)
  const filteredServers = servers.filter(server => {
    if (!user) return true; // No user info, show all servers
    if (user.role === 'admin') return true; // Admin sees all servers
    if (user.role === 'moderator' && user.allowedServers) {
      // Staff only sees assigned servers
      return user.allowedServers.includes(server._id);
    }
    return true; // Regular users or other cases see all servers
  });

  // Auto-calculate expiry date from plan when plan is selected and expiresAt is empty
  useEffect(() => {
    if (formData.planId && !formData.expiresAt && !deviceData) {
      const selectedPlan = plans.find(p => p._id === formData.planId);
      if (selectedPlan && selectedPlan.expiryMonths) {
        const expiryDate = new Date();
        expiryDate.setMonth(expiryDate.getMonth() + selectedPlan.expiryMonths);
        const expiryDateString = expiryDate.toISOString().split('T')[0];
        setFormData((prev) => ({
          ...prev,
          expiresAt: expiryDateString,
        }));
      }
    }
  }, [formData.planId, formData.expiresAt, plans, deviceData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Check if current setup is Enterprise + Unlimited
  const isEnterpriseUnlimited = () => {
    const selectedServer = servers.find(s => s._id === formData.serverId);
    if (!selectedServer || selectedServer.serverType !== 'ENTERPRISE') {
      return false;
    }

    // Check if data limit is unlimited
    // If device override is set, check that
    if (formData.dataLimit && parseFloat(formData.dataLimit) > 0) {
      return false; // Has a data limit
    }

    // If no device override, check plan
    if (formData.planId) {
      const selectedPlan = plans.find(p => p._id === formData.planId);
      if (selectedPlan && selectedPlan.dataLimit?.isUnlimited) {
        return true; // Plan has unlimited data
      }
      if (selectedPlan && selectedPlan.dataLimit?.bytes) {
        return false; // Plan has a data limit
      }
    }

    // If no plan and no device override, it's unlimited
    if (!formData.planId && !formData.dataLimit) {
      return true;
    }

    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Check for Enterprise + Unlimited warning (only for new devices)
    if (!deviceData && isEnterpriseUnlimited()) {
      setShowWarning(true);
      setPendingSubmit(() => async () => {
        await performSubmit();
      });
      return;
    }

    await performSubmit();
  };

  const performSubmit = async () => {
    setLoading(true);
    setShowWarning(false);

    try {
      // Convert dataLimit to bytes based on selected unit
      let dataLimitBytes = null;
      if (formData.dataLimit) {
        const value = parseFloat(formData.dataLimit);
        if (formData.dataLimitUnit === 'GB') {
          dataLimitBytes = Math.round(value * 1024 * 1024 * 1024);
        } else { // MB
          dataLimitBytes = Math.round(value * 1024 * 1024);
        }
      } else if (formData.planId) {
        // Use plan's data limit if device override is empty
        const selectedPlan = plans.find(p => p._id === formData.planId);
        if (selectedPlan && selectedPlan.dataLimit?.bytes) {
          dataLimitBytes = selectedPlan.dataLimit.bytes;
        }
      }
      
      const submitData = {
        serverId: formData.serverId,
        planId: formData.planId,
        userId: formData.userId,
        name: formData.name,
        dataLimit: dataLimitBytes,
        expiresAt: formData.expiresAt,
      };
      await onSubmit(submitData);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
      setPendingSubmit(null);
    }
  };

  const handleWarningConfirm = () => {
    if (pendingSubmit) {
      pendingSubmit();
    }
  };

  const handleWarningCancel = () => {
    setShowWarning(false);
    setPendingSubmit(null);
  };

  return (
    <div>
      {showWarning && (
        <div className="modal-overlay" style={{ zIndex: 1001 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <h2>⚠️ Warning: Enterprise Server with Unlimited Data</h2>
            <div style={{ margin: '20px 0' }}>
              <p style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                You are about to create a device on an <strong>Enterprise server</strong> with <strong>unlimited data</strong>.
              </p>
              <p style={{ marginBottom: '15px', lineHeight: '1.6' }}>
                Enterprise servers are typically reserved for high-value customers or special use cases. 
                Unlimited data on Enterprise servers may have significant cost implications.
              </p>
              <p style={{ marginBottom: '15px', lineHeight: '1.6', fontWeight: 'bold', color: '#d32f2f' }}>
                Are you sure you want to proceed?
              </p>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={handleWarningCancel} disabled={loading}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleWarningConfirm} disabled={loading}>
                Yes, Create Device
              </button>
            </div>
          </div>
        </div>
      )}

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
                {filteredServers.map((server) => (
                  <option key={server._id} value={server._id}>
                    {server.name} ({server.region}) {server.serverType === 'ENTERPRISE' ? '🏢 Enterprise' :
                       server.serverType === 'PREMIUM' ? '💎 Premium' :
                       '🟢 Regular'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="userId">Assign to User (Optional)</label>
              <select
                id="userId"
                name="userId"
                value={formData.userId}
                onChange={handleChange}
              >
                <option value="">Direct Setup (No User Assignment)</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.username} - {user.email} ({user.role})
                  </option>
                ))}
              </select>
              <small>Choose a user to assign this device, or leave empty for direct setup</small>
            </div>
          </div>

          <div className="form-row">
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
                    {plan.name} {plan.dataLimit?.isUnlimited ? '(Unlimited)' : plan.dataLimit?.bytes ? `(${(plan.dataLimit.bytes / (1024 * 1024 * 1024)).toFixed(2)} GB)` : '(No limit)'}
                  </option>
                ))}
              </select>
              <small>Plan provides default data limit for this device</small>
            </div>

            <div className="form-group">
              <label htmlFor="dataLimit">Device Data Limit Override</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="number"
                  id="dataLimit"
                  name="dataLimit"
                  value={formData.dataLimit}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  placeholder="Leave empty to use plan limit"
                  style={{ flex: 1 }}
                />
                <select
                  name="dataLimitUnit"
                  value={formData.dataLimitUnit}
                  onChange={handleChange}
                  style={{ width: '80px' }}
                >
                  <option value="GB">GB</option>
                  <option value="MB">MB</option>
                </select>
              </div>
              <small>Optional: Override plan limit for this device only. Leave empty to use plan limit.</small>
            </div>
          </div>
          <div className="form-row">
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
    </div>
  );
};

export default DeviceForm;
