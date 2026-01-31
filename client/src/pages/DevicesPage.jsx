import React, { useState, useEffect, useContext } from 'react';
import { devicesAPI, serversAPI, plansAPI, usersAPI } from '../api';
import { AuthContext } from '../context/AuthContext';
import DeviceForm from '../components/DeviceForm';
import DeviceList from '../components/DeviceList';
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
  const [selectedServerId, setSelectedServerId] = useState('');
  const [selectedServerType, setSelectedServerType] = useState(''); // Add server type filter

  useEffect(() => {
    fetchData();
  }, [selectedServerId, selectedServerType]); // Refetch when either filter changes

  const fetchData = async () => {
    try {
      setLoading(true);
      const [devicesResponse, serversResponse, plansResponse, usersResponse] = await Promise.all([
        devicesAPI.getAll(selectedServerId || undefined),
        serversAPI.getAll(),
        plansAPI.getAll(true),
        usersAPI.getAll().catch(() => ({ users: [] })), // Fetch users, but don't fail if it errors
      ]);
      const devicesList = Array.isArray(devicesResponse) ? devicesResponse : devicesResponse?.devices || [];
      const serversList = Array.isArray(serversResponse) ? serversResponse : serversResponse?.servers || [];
      const plansList = Array.isArray(plansResponse) ? plansResponse : plansResponse?.plans || [];
      const usersList = Array.isArray(usersResponse) ? usersResponse : usersResponse?.users || [];
      
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
      const response = await devicesAPI.getConfig(deviceId);
      const blob = new Blob([response], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${deviceName || 'device'}.conf`;
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

      <DeviceList
        devices={devices}
        onEdit={handleEditDevice}
        onDelete={handleDeleteDevice}
        onDownloadConfig={handleDownloadConfig}
      />

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
