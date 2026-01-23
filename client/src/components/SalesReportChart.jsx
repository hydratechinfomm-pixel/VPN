import React from 'react';

const SalesReportChart = ({ report, periodData }) => {
  if (!report) {
    return null;
  }

  return (
    <div className="sales-report-charts">
      <div className="card">
        <h3>Plan Breakdown</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Devices</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {report.byPlan.map((row) => (
              <tr key={row._id || 'unknown-plan'}>
                <td>{row._id || 'Unknown'}</td>
                <td>{row.count}</td>
                <td>{row.revenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Server Type Breakdown</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Server Type</th>
              <th>Devices</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {report.byServerType.map((row) => (
              <tr key={row._id || 'unknown-server'}>
                <td>{row._id || 'Unknown'}</td>
                <td>{row.count}</td>
                <td>{row.revenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>User Breakdown</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Devices</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {report.byUser.map((row) => (
              <tr key={row._id || 'unknown-user'}>
                <td>{row._id || 'Unknown'}</td>
                <td>{row.count}</td>
                <td>{row.revenue.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {periodData && periodData.data && (
        <div className="card">
          <h3>Sales by Period ({periodData.period})</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Devices</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {periodData.data.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{row.deviceCount}</td>
                  <td>{row.totalRevenue.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesReportChart;

