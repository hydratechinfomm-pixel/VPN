import React, { useState, useEffect } from 'react';
import { devicesAPI } from '../api';
import '../styles/devices.css';

const DeviceHistoryModal = ({ device, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchHistory();
  }, [device._id]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await devicesAPI.getHistory(device._id);
      setHistory(response.history || []);
    } catch (err) {
      setError('Failed to load device history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getActionIcon = (action, reason) => {
    if (reason === 'auto_limit_reached' || reason === 'auto_expired') return '⚠️';
    if (action === 'CREATED') return '✨';
    if (action === 'UPDATED') return '✏️';
    if (action === 'DELETED') return '🗑️';
    if (action === 'PAUSED' || action.includes('PAUSED')) return '⏸️';
    if (action === 'RESUMED' || action === 'ENABLED') return '▶️';
    if (action === 'DATA_LIMIT_CHANGED') return '📊';
    if (action === 'EXPIRE_DATE_CHANGED') return '📅';
    return '📝';
  };

  const getActionColor = (action, reason) => {
    if (reason === 'auto_limit_reached' || reason === 'auto_expired') return '#ff9800';
    if (action === 'CREATED') return '#4caf50';
    if (action === 'DELETED') return '#f44336';
    if (action.includes('PAUSED')) return '#ff9800';
    if (action === 'RESUMED' || action === 'ENABLED') return '#2196f3';
    return '#757575';
  };

  const getActionLabel = (action, reason) => {
    if (action === 'AUTO_PAUSED_LIMIT') return 'Auto-Paused (Limit Reached)';
    if (action === 'AUTO_PAUSED_EXPIRED') return 'Auto-Paused (Expired)';
    if (action === 'AUTO_RESUMED') return 'Auto-Resumed';
    return action.replace(/_/g, ' ');
  };

  const filteredHistory = filter === 'all' 
    ? history 
    : filter === 'auto'
    ? history.filter(h => h.reason && h.reason.startsWith('auto'))
    : history.filter(h => h.reason === 'manual');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Device History: {device.name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="history-filters">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Events
          </button>
          <button 
            className={`filter-btn ${filter === 'manual' ? 'active' : ''}`}
            onClick={() => setFilter('manual')}
          >
            Manual Changes
          </button>
          <button 
            className={`filter-btn ${filter === 'auto' ? 'active' : ''}`}
            onClick={() => setFilter('auto')}
          >
            Automatic Events
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading history...</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : filteredHistory.length === 0 ? (
          <div className="empty-state">No history records found</div>
        ) : (
          <div className="history-timeline">
            {filteredHistory.map((entry, index) => (
              <div key={entry._id || index} className="history-entry">
                <div 
                  className="history-icon"
                  style={{ backgroundColor: getActionColor(entry.action, entry.reason) }}
                >
                  {getActionIcon(entry.action, entry.reason)}
                </div>
                <div className="history-content">
                  <div className="history-header">
                    <span className="history-action">
                      {getActionLabel(entry.action, entry.reason)}
                    </span>
                    <span className="history-date">{formatDate(entry.createdAt)}</span>
                  </div>
                  
                  {entry.user && (
                    <div className="history-user">
                      By: {entry.user.username || entry.user.email}
                    </div>
                  )}
                  
                  {entry.reason && (
                    <div className={`history-reason ${entry.reason.startsWith('auto') ? 'auto' : 'manual'}`}>
                      {entry.reason === 'auto_limit_reached' && '⚠️ Automatic: Data limit reached'}
                      {entry.reason === 'auto_expired' && '⚠️ Automatic: Device expired'}
                      {entry.reason === 'manual' && '👤 Manual action'}
                      {entry.reason === 'system' && '🔧 System action'}
                    </div>
                  )}
                  
                  {entry.changes && entry.changes.field && (
                    <div className="history-changes">
                      <strong>Changed:</strong> {entry.changes.field}
                      <br />
                      {entry.changes.oldValue !== null && entry.changes.oldValue !== undefined && (
                        <>
                          <span className="old-value">
                            From: {
                              entry.changes.field === 'dataLimit' 
                                ? formatBytes(entry.changes.oldValue)
                                : entry.changes.field === 'expiresAt'
                                ? new Date(entry.changes.oldValue).toLocaleDateString()
                                : String(entry.changes.oldValue)
                            }
                          </span>
                          <br />
                        </>
                      )}
                      <span className="new-value">
                        To: {
                          entry.changes.field === 'dataLimit' 
                            ? (entry.changes.newValue ? formatBytes(entry.changes.newValue) : 'Unlimited')
                            : entry.changes.field === 'expiresAt'
                            ? new Date(entry.changes.newValue).toLocaleDateString()
                            : String(entry.changes.newValue)
                        }
                      </span>
                    </div>
                  )}
                  
                  {entry.metadata && entry.metadata.notes && (
                    <div className="history-notes">
                      📝 {entry.metadata.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default DeviceHistoryModal;
