import React, { useState, useEffect, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usersAPI } from '../api';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import '../styles/history.css';

const HistoryPage = () => {
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [history, setHistory] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [filters, setFilters] = useState({
    userId: searchParams.get('userId') || '',
    deviceName: searchParams.get('deviceName') || '',
    deviceId: searchParams.get('deviceId') || '',
    action: searchParams.get('action') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
  });

  const [activeFilters, setActiveFilters] = useState({
    userId: searchParams.get('userId') || '',
    deviceName: searchParams.get('deviceName') || '',
    deviceId: searchParams.get('deviceId') || '',
    action: searchParams.get('action') || '',
    startDate: searchParams.get('startDate') || '',
    endDate: searchParams.get('endDate') || '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [activeFilters, pagination.page]);

  const fetchUsers = async () => {
    try {
      const response = await usersAPI.getAll();
      const usersList = Array.isArray(response) ? response : response?.users || [];
      setUsers(usersList);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (activeFilters.userId) params.append('userId', activeFilters.userId);
      if (activeFilters.deviceName) params.append('deviceName', activeFilters.deviceName);
      if (activeFilters.deviceId) params.append('deviceId', activeFilters.deviceId);
      if (activeFilters.action) params.append('action', activeFilters.action);
      if (activeFilters.startDate) params.append('startDate', activeFilters.startDate);
      if (activeFilters.endDate) params.append('endDate', activeFilters.endDate);
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);

      const response = await api.get(`/devices/history?${params.toString()}`);
      setHistory(response.history || []);
      setPagination(prev => ({
        ...prev,
        total: response.pagination?.total || 0,
        pages: response.pagination?.pages || 0,
      }));
    } catch (err) {
      console.error('Failed to fetch history:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = () => {
    // Apply filters and reset to page 1
    setActiveFilters({ ...filters });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Allow Enter key to trigger search
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
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

  const getActionBadgeColor = (action, reason) => {
    if (reason === 'auto_limit_reached' || reason === 'auto_expired') return 'warning';
    if (action === 'CREATED') return 'success';
    if (action === 'DELETED') return 'danger';
    if (action.includes('PAUSED')) return 'warning';
    if (action === 'RESUMED' || action === 'ENABLED') return 'info';
    return 'default';
  };

  const getActionLabel = (action) => {
    return action.replace(/_/g, ' ');
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderChangeValue = (field, value) => {
    if (field === 'dataLimit' && value) {
      return formatBytes(value);
    }
    if (field === 'expiresAt' && value) {
      return new Date(value).toLocaleDateString();
    }
    if (value === null || value === undefined) {
      return 'None';
    }
    return String(value);
  };

  return (
    <div className="history-page">
      <div className="page-header">
        <h1>Device History</h1>
        <p>View and filter all device activity and changes</p>
      </div>

      {/* Filters */}
      <div className="history-filters">
        <div className="filter-grid">
          <div className="form-group">
            <label htmlFor="userId">User</label>
            <select
              id="userId"
              name="userId"
              value={filters.userId}
              onChange={handleFilterChange}
            >
              <option value="">All Users</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>
                  {u.username} ({u.email})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="deviceName">Device Name</label>
            <input
              type="text"
              id="deviceName"
              name="deviceName"
              value={filters.deviceName}
              onChange={handleFilterChange}
              onKeyPress={handleKeyPress}
              placeholder="Search by device name..."
            />
          </div>

          <div className="form-group">
            <label htmlFor="action">Action Type</label>
            <select
              id="action"
              name="action"
              value={filters.action}
              onChange={handleFilterChange}
            >
              <option value="">All Actions</option>
              <option value="CREATED">Created</option>
              <option value="UPDATED">Updated</option>
              <option value="DELETED">Deleted</option>
              <option value="NAME_CHANGED">Name Changed</option>
              <option value="PLAN_CHANGED">Plan Changed</option>
              <option value="UPDATE_SERVER">Server Updated</option>
              <option value="DATA_LIMIT_CHANGED">Data Limit Changed</option>
              <option value="PAUSED">Paused</option>
              <option value="RESUMED">Resumed</option>
              <option value="ENABLED">Enabled</option>
              <option value="DISABLED">Disabled</option>
              <option value="AUTO_PAUSED_LIMIT">Auto-Paused (Limit)</option>
              <option value="AUTO_PAUSED_EXPIRED">Auto-Paused (Expired)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="startDate">Start Date</label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="endDate">End Date</label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
            />
          </div>
        </div>

        <div className="filter-actions">
          <button className="btn-primary" onClick={handleSearch}>
            🔍 Search
          </button>
          <span className="filter-results">
            Showing {history.length} of {pagination.total} records
          </span>
        </div>
      </div>

      {/* History Table */}
      {loading ? (
        <div className="loading">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="empty-state">No history records found</div>
      ) : (
        <>
          <div className="history-table-container">
            <table className="data-table history-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Device</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Changes</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry._id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(entry.createdAt)}</td>
                    <td>
                      <strong>{entry.device?.name || 'Deleted Device'}</strong>
                    </td>
                    <td>
                      {entry.user ? (
                        <span>{entry.user.username}</span>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: '#6b7280' }}>System</span>
                      )}
                    </td>
                    <td>
                      <span className={`history-action-badge badge-${getActionBadgeColor(entry.action, entry.reason)}`}>
                        {getActionLabel(entry.action)}
                      </span>
                      {entry.reason && entry.reason.startsWith('auto') && (
                        <span style={{ display: 'block', fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>
                          ⚠️ Automatic
                        </span>
                      )}
                    </td>
                    <td>
                      {entry.changes && entry.changes.field ? (
                        <div style={{ fontSize: '0.875rem' }}>
                          <strong>{entry.changes.field}:</strong>
                          <br />
                          <span style={{ color: '#dc2626' }}>
                            {renderChangeValue(entry.changes.field, entry.changes.oldValue)}
                          </span>
                          {' → '}
                          <span style={{ color: '#059669' }}>
                            {renderChangeValue(entry.changes.field, entry.changes.newValue)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#6b7280' }}>-</span>
                      )}
                    </td>
                    <td>
                      {entry.metadata?.notes ? (
                        <small style={{ fontSize: '0.8125rem', color: '#4b5563' }}>
                          {entry.metadata.notes}
                        </small>
                      ) : (
                        <span style={{ color: '#6b7280' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                className="btn-secondary btn-small"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                « Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                className="btn-secondary btn-small"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
              >
                Next »
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HistoryPage;
