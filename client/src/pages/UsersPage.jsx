import React, { useState, useEffect } from 'react';
import { usersAPI } from '../api';
import UserList from '../components/UserList';
import '../styles/users.css';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      const usersList = Array.isArray(response) ? response : response?.data || [];
      setUsers(usersList);
    } catch (err) {
      setError('Failed to load users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await usersAPI.updateRole(userId, newRole);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      setError('Failed to update user role');
    }
  };

  const handleToggleStatus = async (userId, isActive) => {
    try {
      await usersAPI.updateStatus(userId, !isActive);
      setUsers((prev) =>
        prev.map((u) => (u._id === userId ? { ...u, isActive: !isActive } : u))
      );
    } catch (err) {
      setError('Failed to update user status');
    }
  };

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>User Management</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <UserList
        users={users}
        loading={loading}
        onUpdateRole={handleUpdateRole}
        onToggleStatus={handleToggleStatus}
      />
    </div>
  );
};

export default UsersPage;
