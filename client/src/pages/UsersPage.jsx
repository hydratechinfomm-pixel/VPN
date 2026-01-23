import React, { useState, useEffect } from 'react';
import { usersAPI, serversAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import UserList from '../components/UserList';
import PanelUserForm from '../components/PanelUserForm';
import '../styles/users.css';

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPanelForm, setShowPanelForm] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchUsers();
    fetchServers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      const usersList = response?.users ?? [];
      setUsers(Array.isArray(usersList) ? usersList : []);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchServers = async () => {
    try {
      const response = await serversAPI.getAll();
      const serversList = response?.servers ?? [];
      setServers(Array.isArray(serversList) ? serversList : []);
    } catch (err) {
      console.error('Failed to load servers:', err);
    }
  };

  const handleManageServers = (user) => {
    setSelectedUser(user);
    setShowServerModal(true);
  };

  const handleUpdateServers = async (userId, serverIds) => {
    try {
      await usersAPI.update(userId, { allowedServers: serverIds });
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, allowedServers: serverIds } : u))
      );
      setShowServerModal(false);
      setSelectedUser(null);
    } catch (err) {
      setError(err?.error || 'Failed to update server assignments');
    }
  };

  const handleCreatePanelUser = async (formData) => {
    await usersAPI.createPanelUser(formData);
    fetchUsers();
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await usersAPI.update(userId, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      setError(err?.error || 'Failed to update user role');
    }
  };

  const handleToggleStatus = async (userId, isActive) => {
    try {
      await usersAPI.update(userId, { isActive: !isActive });
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isActive: !isActive } : u))
      );
    } catch (err) {
      setError(err?.error || 'Failed to update user status');
    }
  };

  const isAdmin = currentUser?.role?.toLowerCase() === 'admin';

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>User Management</h1>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowPanelForm(true)}>
            + Create User
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <UserList
        users={users}
        loading={loading}
        currentUserRole={currentUser?.role}
        onUpdateRole={handleUpdateRole}
        onToggleStatus={handleToggleStatus}
        onManageServers={handleManageServers}
      />

      {showPanelForm && (
        <PanelUserForm
          onSubmit={handleCreatePanelUser}
          onCancel={() => setShowPanelForm(false)}
        />
      )}

      {showServerModal && selectedUser && (
        <ServerAssignmentModal
          user={selectedUser}
          servers={servers}
          onSubmit={handleUpdateServers}
          onCancel={() => {
            setShowServerModal(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
};

const ServerAssignmentModal = ({ user, servers, onSubmit, onCancel }) => {
  const [selectedServers, setSelectedServers] = useState(user.allowedServers || []);

  const handleToggleServer = (serverId) => {
    setSelectedServers((prev) =>
      prev.includes(serverId)
        ? prev.filter(id => id !== serverId)
        : [...prev, serverId]
    );
  };

  const handleSubmit = () => {
    onSubmit(user._id, selectedServers);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Manage Server Assignments</h2>
        <p className="mb-4">Assign servers that {user.username} (Staff) can access:</p>

        <div className="server-assignment-list">
          {servers.map((server) => (
            <div key={server._id} className="server-assignment-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedServers.includes(server._id)}
                  onChange={() => handleToggleServer(server._id)}
                />
                <span className="checkbox-text">
                  {server.name} ({server.region}) - {server.serverType}
                </span>
              </label>
            </div>
          ))}
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleSubmit}>
            Save Assignments
          </button>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
