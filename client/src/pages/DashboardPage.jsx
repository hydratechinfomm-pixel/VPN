import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { serversAPI } from '../api';
import DashboardStats from '../components/DashboardStats';
import ServerList from '../components/ServerList';
import '../styles/dashboard.css';

const DashboardPage = () => {
  const { user } = useAuth();
  const [servers, setServers] = useState([]);
  const [stats, setStats] = useState({ totalServers: 0, activeServers: 0, totalKeys: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await serversAPI.getAll();
      setServers(response);
      
      // Calculate stats
      const activeCount = response.filter((s) => s.isActive).length;
      setStats({
        totalServers: response.length,
        activeServers: activeCount,
        totalKeys: response.reduce((sum, s) => sum + (s.accessKeys?.length || 0), 0),
      });
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome, {user?.name || 'User'}!</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DashboardStats stats={stats} loading={loading} />

      <div className="dashboard-section">
        <div className="section-header">
          <h2>VPN Servers</h2>
        </div>
        <ServerList servers={servers} loading={loading} onRefresh={fetchData} />
      </div>
    </div>
  );
};

export default DashboardPage;
