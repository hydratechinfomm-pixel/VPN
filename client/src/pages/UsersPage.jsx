import React, { useState, useEffect } from 'react';
import { usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import UserList from '../components/UserList';
import PanelUserForm from '../components/PanelUserForm';
import '../styles/users.css';

const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPanelForm, setShowPanelForm] = useState(false);

  useEffect(() => {
    fetchUsers();
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
            + Create Panel User
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
      />

      {showPanelForm && (
        <PanelUserForm
          onSubmit={handleCreatePanelUser}
          onCancel={() => setShowPanelForm(false)}
        />
      )}
    </div>
  );
};

export default UsersPage;
