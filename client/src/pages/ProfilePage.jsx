import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../api';
import '../styles/profile.css';

const ProfilePage = () => {
  const { user, updateProfile, logout } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSessions, setShowSessions] = useState(false);

  // Fetch active sessions
  const fetchSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await authAPI.getActiveSessions();
      setSessions(response.sessions || []);
      setShowSessions(true);
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  // Logout from other devices
  const handleLogoutOthers = async () => {
    if (!window.confirm('Are you sure? This will logout all other devices.')) return;
    try {
      await authAPI.logoutOtherDevices();
      setMessage('All other devices have been logged out');
      await fetchSessions();
    } catch (err) {
      setError('Failed to logout other devices');
    }
  };

  // Logout from specific device
  const handleLogoutDevice = async (deviceId) => {
    if (!window.confirm('Are you sure you want to logout this device?')) return;
    try {
      await authAPI.logoutDevice(deviceId);
      setMessage('Device logged out successfully');
      await fetchSessions();
    } catch (err) {
      setError('Failed to logout device');
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await updateProfile(formData);
      setMessage('Profile updated successfully');
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await authAPI.changePassword(
        passwordData.currentPassword,
        passwordData.newPassword
      );
      setMessage('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError('Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>My Profile</h1>
      </div>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="profile-grid">
        <div className="profile-card">
          <h2>Profile Information</h2>
          <div className="user-info">
            <div className="info-item">
              <span className="label">Name:</span>
              <span className="value">{user?.name}</span>
            </div>
            <div className="info-item">
              <span className="label">Email:</span>
              <span className="value">{user?.email}</span>
            </div>
            <div className="info-item">
              <span className="label">Role:</span>
              <span className="value badge">{user?.role}</span>
            </div>
            <div className="info-item">
              <span className="label">Status:</span>
              <span className={`value badge ${user?.isActive ? 'active' : 'inactive'}`}>
                {user?.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        <div className="profile-card">
          <h2>Edit Profile</h2>
          <form onSubmit={handleUpdateProfile}>
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleProfileChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleProfileChange}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        <div className="profile-card">
          <h2>Change Password</h2>
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>

      <div className="profile-actions">
        <button className="btn-secondary" onClick={() => fetchSessions()}>
          🔐 Manage Sessions
        </button>
        <button className="btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {showSessions && (
        <div className="sessions-section">
          <div className="sessions-header">
            <h3>Active Sessions</h3>
            <button className="btn-danger-outline" onClick={handleLogoutOthers}>
              Logout All Other Devices
            </button>
          </div>

          {sessionsLoading ? (
            <div className="loading">Loading sessions...</div>
          ) : sessions.length === 0 ? (
            <div className="empty-state">No active sessions</div>
          ) : (
            <div className="sessions-list">
              {sessions.map((session) => {
                const isCurrentDevice = session.deviceId === localStorage.getItem('deviceId');
                const loginTime = new Date(session.createdAt);
                const expiresTime = new Date(session.expiresAt);
                
                return (
                  <div key={session.deviceId} className={`session-card ${isCurrentDevice ? 'current-device' : ''}`}>
                    <div className="session-info">
                      <div className="session-header">
                        <h4>
                          {isCurrentDevice && <span className="badge-current">Current Device</span>}
                          {session.deviceId}
                        </h4>
                      </div>
                      
                      <div className="session-details">
                        <div className="detail-row">
                          <span className="label">📍 IP Address:</span>
                          <span className="value">{session.ipAddress || 'Unknown'}</span>
                        </div>
                        
                        <div className="detail-row">
                          <span className="label">🔧 User Agent:</span>
                          <span className="value">{session.userAgent?.substring(0, 60) || 'Unknown'}...</span>
                        </div>
                        
                        <div className="detail-row">
                          <span className="label">📅 Login Time:</span>
                          <span className="value">{loginTime.toLocaleString()}</span>
                        </div>
                        
                        <div className="detail-row">
                          <span className="label">⏰ Expires:</span>
                          <span className="value">{expiresTime.toLocaleString()}</span>
                        </div>
                      </div>

                      {!isCurrentDevice && (
                        <button 
                          className="btn-danger-small" 
                          onClick={() => handleLogoutDevice(session.deviceId)}
                        >
                          Logout This Device
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
