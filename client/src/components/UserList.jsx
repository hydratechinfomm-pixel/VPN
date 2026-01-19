import React from 'react';

const ROLE_LABELS = { admin: 'Admin', moderator: 'Staff', user: 'User' };

const UserList = ({ users, loading, currentUserRole, onUpdateRole, onToggleStatus }) => {
  const roleLower = currentUserRole?.toLowerCase();
  const isStaff = roleLower === 'moderator';

  const displayName = (u) =>
    [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.username || u.email || '—';

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
          {users.map((user) => {
            const userRole = user.role?.toLowerCase();
            const isTargetAdmin = userRole === 'admin';
            const canEditRole = !isStaff || !isTargetAdmin;
            const canToggleStatus = !isStaff || !isTargetAdmin;

            return (
              <tr key={user._id}>
                <td className="font-bold">{displayName(user)}</td>
                <td>{user.email}</td>
                <td>
                  <select
                    value={user.role || 'user'}
                    onChange={(e) => onUpdateRole(user._id, e.target.value)}
                    className="role-select"
                    disabled={!canEditRole}
                  >
                    <option value="user">{ROLE_LABELS.user}</option>
                    <option value="moderator">{ROLE_LABELS.moderator}</option>
                    {(!isStaff || isTargetAdmin) && (
                      <option value="admin">{ROLE_LABELS.admin}</option>
                    )}
                  </select>
                </td>
                <td>
                  <span className={`badge ${user.isActive ? 'active' : 'inactive'}`}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
                <td className="actions">
                  {canToggleStatus && (
                    <button
                      className={`btn-small ${user.isActive ? 'btn-warning' : 'btn-success'}`}
                      onClick={() => onToggleStatus(user._id, user.isActive)}
                    >
                      {user.isActive ? '🔒 Deactivate' : '🔓 Activate'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default UserList;
