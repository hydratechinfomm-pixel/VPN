import React, { useState } from 'react';
import { devicesAPI } from '../api';

const DeviceMigrateModal = ({ device, servers = [], onClose, onSuccess }) => {
  const [targetServerId, setTargetServerId] = useState('');
  const [importUsage, setImportUsage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const outlineServers = servers.filter(s => s.vpnType === 'outline' && s.isActive && String(s._id) !== String(device.server?._id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!targetServerId) {
      setError('Please select a target server');
      return;
    }
    setLoading(true);
    try {
      const result = await devicesAPI.migrate(device._id, { targetServerId, importUsage });
      onSuccess && onSuccess(result);
    } catch (err) {
      setError(err?.error || err?.message || 'Migration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1001 }}>
      <div className="modal-content" style={{ maxWidth: 520 }}>
        <h2>🔀 Migrate Device</h2>
        <p>Device: <strong>{device.name}</strong> — current server: <strong>{device.server?.name || 'N/A'}</strong></p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="targetServer">Target Outline Server *</label>
            <select id="targetServer" value={targetServerId} onChange={(e) => setTargetServerId(e.target.value)} required>
              <option value="">Select target server</option>
              {outlineServers.map(s => (
                <option key={s._id} value={s._id}>{s.name} ({s.region})</option>
              ))}
            </select>
            <small>Select the Outline server to move this device's access key to. Only active Outline servers are shown.</small>
          </div>

          <div className="form-group">
            <label>
              <input type="checkbox" checked={importUsage} onChange={(e) => setImportUsage(e.target.checked)} />
              {' '}Import previous usage & remaining quota (recommended)
            </label>
            <small>When checked, the device's usage snapshot and remaining quota will be preserved on the target key.</small>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Migrating...' : 'Migrate Device'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DeviceMigrateModal;
