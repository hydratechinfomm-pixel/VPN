import React, { useState, useEffect, useContext } from 'react';
import { devicesAPI, serversAPI, plansAPI, usersAPI } from '../api';
import { AuthContext } from '../context/AuthContext';
import DeviceForm from '../components/DeviceForm';
import DeviceList from '../components/DeviceList';
import DeviceMigrateModal from '../components/DeviceMigrateModal';
import '../styles/devices.css';

const DevicesPage = () => {
  const { user } = useContext(AuthContext);
  const [devices, setDevices] = useState([]);
  const [servers, setServers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [migratingDevice, setMigratingDevice] = useState(null);
  const [selectedServerId, setSelectedServerId] = useState('');
  const [selectedServerType, setSelectedServerType] = useState(''); // Add server type filter
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDevices, setTotalDevices] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [selectedServerId, selectedServerType]);

  useEffect(() => {
    fetchData();
  }, [selectedServerId, selectedServerType, currentPage]); // Refetch when filters or page changes

  const fetchData = async (withStats = false) => {
    try {
      setLoading(true);
      if (withStats) setLoadingStats(true);
      
      const [devicesResponse, serversResponse, plansResponse, usersResponse] = await Promise.all([
        devicesAPI.getAll(selectedServerId || undefined, undefined, { 
          page: currentPage, 
          limit: 50, 
          includeStats: withStats 
        }),
        serversAPI.getAll(),
        plansAPI.getAll(true),
        usersAPI.getAll().catch(() => ({ users: [] })), // Fetch users, but don't fail if it errors
      ]);
      
      const devicesList = devicesResponse?.devices || [];
      const serversList = Array.isArray(serversResponse) ? serversResponse : serversResponse?.servers || [];
      const plansList = Array.isArray(plansResponse) ? plansResponse : plansResponse?.plans || [];
      const usersList = Array.isArray(usersResponse) ? usersResponse : usersResponse?.users || [];
      
      // Update pagination
      setTotalPages(devicesResponse?.pages || 1);
      setTotalDevices(devicesResponse?.total || devicesList.length);
      
      // Filter devices by server type if selected
      let filteredDevices = devicesList.filter(device => {
        if (user.role === 'staff') {
          // Staff can only see servers assigned to them
          if (!user.allowedServers || user.allowedServers.length === 0) {
            return false; // No servers assigned
          }
          // Compare server IDs (handle both string and ObjectId)
          return user.allowedServers.some(allowedServerId => {
            const allowedId = allowedServerId._id || allowedServerId;
            return String(allowedId) === String(device.server?._id);
          });
        }
        return true;
      });
      if (selectedServerType) {
        filteredDevices = devicesList.filter(
          (device) => device.server?.vpnType === selectedServerType
        );
      }

      // Filter servers based on user role (Staff can only see assigned servers)
      const filteredServers = serversList.filter(server => {
        if (user.role === 'staff') {
          // Staff can only see servers assigned to them
          if (!user.allowedServers || user.allowedServers.length === 0) {
            return false; // No servers assigned
          }
          // Compare server IDs (handle both string and ObjectId)
          return user.allowedServers.some(allowedServerId => {
            const allowedId = allowedServerId._id || allowedServerId;
            return String(allowedId) === String(server._id);
          });
        }
        return true;
      });
      
      setDevices(filteredDevices);
      setServers(filteredServers);
      setPlans(plansList);
      setUsers(usersList);
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
      if (withStats) setLoadingStats(false);
    }
  };

  const handleRefreshStats = async () => {
    if (devices.length === 0) return;
    
    try {
      setLoadingStats(true);
      const deviceIds = devices.map(d => d._id);
      const response = await devicesAPI.bulkRefreshStats(deviceIds);
      
      // Update local devices with fresh stats
      if (response.stats && Array.isArray(response.stats)) {
        setDevices(prevDevices => 
          prevDevices.map(device => {
            const updated = response.stats.find(s => s.deviceId === device._id);
            if (updated && updated.success && updated.stats) {
              return {
                ...device,
                usage: {
                  bytesSent: updated.stats.uplink || 0,
                  bytesReceived: updated.stats.downlink || updated.stats.bytesUsed || 0,
                  lastSync: new Date(),
                },
                totalBytesUsed: updated.stats.bytesUsed || 0
              };
            }
            return device;
          })
        );
      }
    } catch (err) {
      console.error('Failed to refresh stats:', err);
      setError('Failed to refresh stats. Falling back to full reload...');
      // Fallback: reload with stats
      setTimeout(() => fetchData(true), 500);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleAddDevice = () => {
    setEditingDevice(null);
    setShowForm(true);
  };

  const handleEditDevice = (device) => {
    setEditingDevice(device);
    setShowForm(true);
  };

  const handleMigrateDevice = (device) => {
    setMigratingDevice(device);
    setShowMigrateModal(true);
  };

  const handleMigrateSuccess = async (migrationResult) => {
    // Refresh list and close modal
    setShowMigrateModal(false);
    setMigratingDevice(null);
    fetchData();

    // If backend returned an accessUrl, prompt download / show QR
    if (migrationResult?.accessUrl) {
      // Try to open QR modal by fetching QR from API (DeviceList handles QR)
      // As a simple UX, copy the access URL to clipboard and alert user
      try {
        await navigator.clipboard.writeText(migrationResult.accessUrl);
        alert('Migration successful — access URL copied to clipboard. You can download QR or config from the device list.');
      } catch (err) {
        alert('Migration successful — new access URL available in device details.');
      }
    } else {
      alert('Migration successful');
    }
  };

  const handleDeleteDevice = async (deviceId) => {
    if (!window.confirm('Are you sure you want to delete this device?')) return;

    try {
      await devicesAPI.delete(deviceId);
      setDevices((prev) => prev.filter((d) => d._id !== deviceId));
    } catch (err) {
      setError('Failed to delete device');
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editingDevice) {
        await devicesAPI.update(editingDevice._id, formData);
        setDevices((prev) =>
          prev.map((d) => (d._id === editingDevice._id ? { ...d, ...formData } : d))
        );
      } else {
        const response = await devicesAPI.create(formData);
        const newDevice = response.device || response;
        setDevices((prev) => [...prev, newDevice]);
      }
      setShowForm(false);
      setEditingDevice(null);
      fetchData(); // Refresh to get updated data
    } catch (err) {
      setError(editingDevice ? 'Failed to update device' : 'Failed to create device');
    }
  };

  const handleDownloadConfig = async (deviceId, deviceName) => {
    try {
      // Fetch device to determine vpnType so we can choose an appropriate filename
      const deviceInfo = await devicesAPI.getOne(deviceId);
      const vpnType = deviceInfo?.server?.vpnType;

      const response = await devicesAPI.getConfig(deviceId);
      const blob = new Blob([response], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      let ext = 'conf';
      if (vpnType === 'outline') ext = 'txt';
      else if (vpnType === 'v2ray') ext = 'vmess.txt';
      a.download = `${deviceName || 'device'}.${ext}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download config');
    }
  };

  if (loading) {
    return <div className="loading-screen">Loading devices...</div>;
  }

  const isAdminOrstaff = user && (user.role === 'admin' || user.role === 'staff');

  return (
    <div className="accesskeys-page">
      <div className="page-header">
        <h1>Devices Management</h1>
        {isAdminOrstaff && (
          <button className="btn-primary" onClick={handleAddDevice}>
            + Add Device
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filters">
        <select
          value={selectedServerType}
          onChange={(e) => setSelectedServerType(e.target.value)}
          className="filter-select"
        >
          <option value="">All VPN Types</option>
          <option value="wireguard">🔷 WireGuard</option>
          <option value="v2ray">🟣 V2Ray</option>
          <option value="outline">🔶 Outline</option>
        </select>

        <select
          value={selectedServerId}
          onChange={(e) => setSelectedServerId(e.target.value)}
          className="filter-select"
        >
          <option value="">All Servers</option>
          {servers.map((server) => (
            <option key={server._id} value={server._id}>
              {server.name} ({server.region})
            </option>
          ))}
        </select>
      </div>

      <div className="devices-toolbar" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        padding: '10px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button 
            className="btn-secondary" 
            onClick={handleRefreshStats}
            disabled={loadingStats}
            style={{ opacity: loadingStats ? 0.6 : 1 }}
          >
            {loadingStats ? '⏳ Loading Stats...' : '🔄 Refresh Stats'}
          </button>
          <span style={{ fontSize: '14px', color: '#666' }}>
            Showing {devices.length} of {totalDevices} devices
          </span>
        </div>

        {totalPages > 1 && (
          <div className="pagination" style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button 
              className="btn-secondary"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || loading}
              style={{ padding: '5px 12px' }}
            >
              ← Prev
            </button>
            <span style={{ padding: '5px 15px', fontWeight: 'bold' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              className="btn-secondary"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || loading}
              style={{ padding: '5px 12px' }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <DeviceList
        devices={devices}
        onEdit={handleEditDevice}
        onDelete={handleDeleteDevice}
        onDownloadConfig={handleDownloadConfig}
        onMigrate={handleMigrateDevice}
      />

      {showMigrateModal && migratingDevice && (
        <DeviceMigrateModal
          device={migratingDevice}
          servers={servers}
          onClose={() => { setShowMigrateModal(false); setMigratingDevice(null); }}
          onSuccess={handleMigrateSuccess}
        />
      )}

      {showForm && (
        <DeviceForm
          deviceData={editingDevice}
          servers={servers}
          plans={plans}
          users={users}
          user={user}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingDevice(null);
          }}
        />
      )}
    </div>
  );
};

export default DevicesPage;
