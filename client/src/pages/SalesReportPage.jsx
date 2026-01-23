import React, { useEffect, useState } from 'react';
import { salesAPI, usersAPI, plansAPI } from '../api';
import SalesReportFilters from '../components/SalesReportFilters';
import SalesReportChart from '../components/SalesReportChart';

const SalesReportPage = () => {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    serverType: '',
    userId: '',
    planId: '',
    period: 'daily',
  });
  const [report, setReport] = useState(null);
  const [periodData, setPeriodData] = useState(null);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('details'); // summary | breakdown | details

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const [usersRes, plansRes] = await Promise.all([
          usersAPI.getAll(),
          plansAPI.getAll(true),
        ]);
        setUsers(usersRes?.users || []);
        setPlans(plansRes?.plans || []);

        await fetchReport(); // initial load with default filters
      } catch (err) {
        setError('Failed to load initial data');
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError('');
      const [reportRes, periodRes] = await Promise.all([
        salesAPI.getReport(filters),
        salesAPI.getByPeriod(filters.period || 'daily', filters),
      ]);
      setReport(reportRes);
      setPeriodData(periodRes);
    } catch (err) {
      setError(err?.error || 'Failed to load sales report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sales-report-page">
      <div className="page-header">
        <h1>Sales Report</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <SalesReportFilters
        filters={filters}
        onChange={setFilters}
        users={users}
        plans={plans}
      />

      <div className="form-actions" style={{ marginBottom: '16px' }}>
        <button
          type="button"
          className="btn-primary"
          onClick={fetchReport}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Apply Filters'}
        </button>
      </div>

      {/* Tabs for different report views */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'breakdown' ? 'active' : ''}`}
          onClick={() => setActiveTab('breakdown')}
        >
          Breakdown
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
      </div>

      {report && activeTab === 'summary' && (
        <div className="summary-cards">
          <div className="card summary-card">
            <h3>Total Revenue</h3>
            <p className="summary-value">
              {report.totalRevenue.toFixed(2)}
            </p>
          </div>
          <div className="card summary-card">
            <h3>Total Devices</h3>
            <p className="summary-value">{report.deviceCount}</p>
          </div>
          <div className="card summary-card">
            <h3>Average Revenue per Device</h3>
            <p className="summary-value">
              {report.deviceCount > 0
                ? (report.totalRevenue / report.deviceCount).toFixed(2)
                : '0.00'}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'breakdown' && (
        <SalesReportChart report={report} periodData={periodData} />
      )}

      {report && activeTab === 'details' && (
        <div className="card">
          <h3>Detailed Transactions</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Device</th>
                <th>Server</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Created At</th>
                <th>Expires At</th>
              </tr>
            </thead>
            <tbody>
              {(report.transactions || []).map((tx) => (
                <tr key={tx._id}>
                  <td>{tx.userName || '—'}</td>
                  <td>{tx.deviceName || '—'}</td>
                  <td>{tx.serverName || '—'}</td>
                  <td>{tx.planName || '—'}</td>
                  <td>
                    {(tx.planCurrency || 'USD')}{' '}
                    {typeof tx.planPrice === 'number'
                      ? tx.planPrice.toFixed(2)
                      : '0.00'}
                  </td>
                  <td>
                    {tx.createdAt
                      ? new Date(tx.createdAt).toLocaleString()
                      : '—'}
                  </td>
                  <td>
                    {tx.expiresAt
                      ? new Date(tx.expiresAt).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SalesReportPage;

