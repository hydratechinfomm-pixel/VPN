import React from 'react';

const ROLE_LABELS = { admin: 'Admin', staff: 'Staff', user: 'User' };

const UserList = ({ users, loading, currentUserRole, onUpdateRole, onToggleStatus, onManageServers }) => {
  const roleLower = currentUserRole?.toLowerCase();
  const isStaff = roleLower === 'staff';

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
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Servers</th>
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
                      <option value="staff">{ROLE_LABELS.staff}</option>
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
                  <td>
                    {user.role?.toLowerCase() === 'staff' && (
                      <button
                        className="btn-small btn-info"
                        onClick={() => onManageServers && onManageServers(user)}
                        title="Manage server assignments"
                      >
                        🖥️ {user.allowedServers?.length || 0}
                      </button>
                    )}
                    {user.role?.toLowerCase() === 'admin' && (
                      <span className="text-muted">All servers</span>
                    )}
                    {user.role?.toLowerCase() === 'user' && (
                      <span className="text-muted">—</span>
                    )}
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
    </div>
  );
};

export default UserList;
