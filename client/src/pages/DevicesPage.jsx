import React, { useState, useEffect } from 'react';
import { devicesAPI, serversAPI, plansAPI } from '../api';
import DeviceForm from '../components/DeviceForm';
import DeviceList from '../components/DeviceList';
import '../styles/devices.css';

const DevicesPage = () => {
  const [devices, setDevices] = useState([]);
  const [servers, setServers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [selectedServerId, setSelectedServerId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [devicesResponse, serversResponse, plansResponse] = await Promise.all([
        devicesAPI.getAll(selectedServerId || undefined),
        serversAPI.getAll(),
        plansAPI.getAll(true),
      ]);
      const devicesList = Array.isArray(devicesResponse) ? devicesResponse : devicesResponse?.devices || [];
      const serversList = Array.isArray(serversResponse) ? serversResponse : serversResponse?.servers || [];
      const plansList = Array.isArray(plansResponse) ? plansResponse : plansResponse?.plans || [];
      setDevices(devicesList);
      setServers(serversList);
      setPlans(plansList);
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

  return (
    <div className="accesskeys-page">
      <div className="page-header">
        <h1>Devices Management</h1>
        <button className="btn-primary" onClick={handleAddDevice}>
          + Add Device
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filters">
        <select
          value={selectedServerId}
          onChange={(e) => {
            setSelectedServerId(e.target.value);
            fetchData();
          }}
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
