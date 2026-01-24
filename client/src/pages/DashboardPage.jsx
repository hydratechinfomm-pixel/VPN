import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { serversAPI, devicesAPI } from '../api';
import DashboardStats from '../components/DashboardStats';
import ServerList from '../components/ServerList';
import '../styles/dashboard.css';

const DashboardPage = () => {
  const { user } = useAuth();
  const [servers, setServers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({ 
    totalServers: 0,
    wireguardServers: 0,
    outlineServers: 0,
    activeServers: 0, 
    totalDevices: 0,
    onlineDevices: 0,
    totalUsage: 0 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [serversResponse, devicesResponse] = await Promise.all([
        serversAPI.getAll(),
        devicesAPI.getAll(),
      ]);
      
      // Handle both direct array and wrapped response
      const serversList = Array.isArray(serversResponse) ? serversResponse : serversResponse?.servers || [];
      const devicesList = Array.isArray(devicesResponse) ? devicesResponse : devicesResponse?.devices || [];
      
      setServers(serversList);
      setDevices(devicesList);
      
      // Calculate stats
      const activeCount = serversList.filter((s) => s.isActive).length;
      const wireguardCount = serversList.filter((s) => s.vpnType === 'wireguard').length;
      const outlineCount = serversList.filter((s) => s.vpnType === 'outline').length;
      const onlineDevices = devicesList.filter((d) => d.connectivity?.isConnected && d.isEnabled).length;
      const totalUsage = devicesList.reduce((sum, d) => {
        return sum + (d.usage?.bytesSent || 0) + (d.usage?.bytesReceived || 0);
      }, 0);
      
      setStats({
        totalServers: serversList.length,
        wireguardServers: wireguardCount,
        outlineServers: outlineCount,
        activeServers: activeCount,
        totalDevices: devicesList.length,
        onlineDevices,
        totalUsage,
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
        <p>Welcome, {user?.username || 'User'}!</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <DashboardStats stats={stats} loading={loading} servers={servers} />

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
