import React from 'react';

const UserList = ({ users, loading, onUpdateRole, onToggleStatus }) => {
  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  if (users.length === 0) {
    return (
      <div className="empty-state">
        <p>No users found.</p>
      </div>
    );
  }

  return (
    <div className="user-list">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id}>
              <td className="font-bold">{user.name}</td>
              <td>{user.email}</td>
              <td>
                <select
                  value={user.role}
                  onChange={(e) => onUpdateRole(user._id, e.target.value)}
                  className="role-select"
                >
                  <option value="User">User</option>
                  <option value="Moderator">Moderator</option>
                  <option value="Admin">Admin</option>
                </select>
              </td>
              <td>
                <span className={`badge ${user.isActive ? 'active' : 'inactive'}`}>
                  {user.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>{new Date(user.createdAt).toLocaleDateString()}</td>
              <td className="actions">
                <button
                  className={`btn-small ${user.isActive ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => onToggleStatus(user._id, user.isActive)}
                >
                  {user.isActive ? '🔒 Deactivate' : '🔓 Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserList;
