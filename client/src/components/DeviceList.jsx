import React, { useState } from 'react';
import { devicesAPI } from '../api';
import QRCodeViewer from './QRCodeViewer';

const DeviceList = ({ devices, onEdit, onDelete, onDownloadConfig }) => {
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleViewQR = async (device) => {
    try {
      const response = await devicesAPI.getQR(device._id);
      setQrData(response);
      setSelectedDevice(device);
      setShowQR(true);
    } catch (err) {
      alert('Failed to load QR code');
    }
  };

  const handleToggleStatus = async (device, newStatus) => {
    try {
      await devicesAPI.toggleStatus(device._id, newStatus, device.isEnabled);
      window.location.reload();
    } catch (err) {
      alert('Failed to update device status');
    }
  };

  const handleDisconnect = async (device) => {
    if (!window.confirm('Are you sure you want to disconnect this device?')) return;
    try {
      await devicesAPI.disconnect(device._id);
      window.location.reload();
    } catch (err) {
      alert('Failed to disconnect device');
    }
  };

  if (devices.length === 0) {
    return <div className="empty-state">No devices found</div>;
  }

  return (
    <>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Server</th>
              <th>VPN IP</th>
              <th>Plan</th>
              <th>Usage</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => {
              const totalUsage = (device.usage?.bytesSent || 0) + (device.usage?.bytesReceived || 0);
              const limit = device.dataLimit?.bytes || device.plan?.dataLimit?.bytes;
              const usagePercent = limit ? (totalUsage / limit) * 100 : 0;

              return (
                <tr key={device._id}>
                  <td>{device.name}</td>
                  <td>{device.server?.name || 'N/A'}</td>
                  <td>{device.vpnIp}</td>
                  <td>
                    {device.plan?.name || 'No Plan'}
                    {device.isUnlimited && ' (Unlimited)'}
                  </td>
                  <td>
                    <div className="usage-info">
                      <span>{formatBytes(totalUsage)}</span>
                      {limit && (
                        <div className="usage-bar">
                          <div
                            className="usage-fill"
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-${device.status?.toLowerCase()}`}>
                      {device.status}
                    </span>
                    {device.isEnabled ? (
                      <span className="status-badge status-active">Enabled</span>
                    ) : (
                      <span className="status-badge status-disabled">Disabled</span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => handleViewQR(device)}
                        title="View QR Code"
                      >
                        📱
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => onDownloadConfig(device._id, device.name)}
                        title="Download Config"
                      >
                        ⬇️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => onEdit(device)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleToggleStatus(device, device.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                        title={device.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                      >
                        {device.status === 'ACTIVE' ? '⏸️' : '▶️'}
                      </button>
                      <button
                        className="btn-icon"
                        onClick={() => handleDisconnect(device)}
                        title="Disconnect"
                      >
                        🔌
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => onDelete(device._id)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showQR && qrData && (
        <QRCodeViewer
          device={selectedDevice}
          qrCode={qrData.qrCode}
          config={qrData.config}
          onClose={() => {
            setShowQR(false);
            setQrData(null);
            setSelectedDevice(null);
          }}
          onDownload={() => onDownloadConfig(selectedDevice._id, selectedDevice.name)}
        />
      )}
    </>
  );
};

export default DeviceList;
