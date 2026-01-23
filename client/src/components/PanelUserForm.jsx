import React, { useState } from 'react';

const PanelUserForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user',
    phone: '',
    nickname: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      // Clear phone and nickname when switching away from user role
      if (name === 'role' && value !== 'user') {
        return { ...prev, [name]: value, phone: '', nickname: '' };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(formData);
      onCancel();
    } catch (err) {
      setError(err.error || err.message || 'Failed to create panel user');
    } finally {
      setLoading(false);
    }
  };

  const getFormTitle = () => {
    switch (formData.role) {
      case 'admin': return 'Create Admin User';
      case 'moderator': return 'Create Staff User';
      case 'user': return 'Create User';
      default: return 'Create User';
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{getFormTitle()}</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={3}
              placeholder="e.g. staff1"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="staff@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              placeholder="Min 6 characters"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="role">Role *</label>
            <select id="role" name="role" value={formData.role} onChange={handleChange} required>
              <option value="user">User (view only, own devices)</option>
              <option value="moderator">Staff (all except VPN server operations)</option>
              <option value="admin">Admin (full control)</option>
            </select>
          </div>

          {/* Only show phone and nickname for user role */}
          {formData.role === 'user' && (
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="phone">Phone *</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="e.g. +1234567890"
                />
              </div>
              <div className="form-group">
                <label htmlFor="nickname">Nickname *</label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  required
                  placeholder="e.g. John"
                />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : getFormTitle()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PanelUserForm;
