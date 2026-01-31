import React from 'react';

const SalesReportFilters = ({ filters, onChange, users, plans, servers }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onChange({
      ...filters,
      [name]: value,
    });
  };

  return (
    <div className="card filters-card">
      <h3>Filters</h3>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="startDate">Start Date</label>
          <input
            type="date"
            id="startDate"
            name="startDate"
            value={filters.startDate || ''}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="endDate">End Date</label>
          <input
            type="date"
            id="endDate"
            name="endDate"
            value={filters.endDate || ''}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="serverType">Server Type</label>
          <select
            id="serverType"
            name="serverType"
            value={filters.serverType || ''}
            onChange={handleChange}
          >
            <option value="">All</option>
            <option value="REGULAR">REGULAR</option>
            <option value="PREMIUM">PREMIUM</option>
            <option value="ENTERPRISE">ENTERPRISE</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="period">Period</label>
          <select
            id="period"
            name="period"
            value={filters.period || 'daily'}
            onChange={handleChange}
          >
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="userId">User</label>
          <select
            id="userId"
            name="userId"
            value={filters.userId || ''}
            onChange={handleChange}
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.username || u.email}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="planId">Plan</label>
          <select
            id="planId"
            name="planId"
            value={filters.planId || ''}
            onChange={handleChange}
          >
            <option value="">All Plans</option>
            {plans.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="server">Server</label>
          <select
            id="serverId"
            name="serverId"
            value={filters.serverId || ''}
            onChange={handleChange}
          >
            <option value="">All Servers</option>
            {servers.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default SalesReportFilters;

