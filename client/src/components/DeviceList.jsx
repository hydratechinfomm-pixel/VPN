import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { devicesAPI } from '../api';
import { AuthContext } from '../context/AuthContext';
import QRCodeViewer from './QRCodeViewer';
import DeviceHistoryModal from './DeviceHistoryModal';

const DeviceList = ({ devices, onEdit, onDelete, onDownloadConfig }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getUsageBarColor = (percentage) => {
    if (percentage > 100) return '#dc2626'; // dark red for exceeded
    if (percentage >= 90) return '#ef4444'; // red
    if (percentage >= 70) return '#f59e0b'; // yellow
    return '#10b981'; // green
  };

  const getUsageStatus = (percentage) => {
    if (percentage > 100) return { text: 'Limit Exceeded', color: '#dc2626' };
    if (percentage >= 100) return { text: 'Limit Reached', color: '#dc2626' };
    if (percentage >= 90) return { text: 'Critical', color: '#ea580c' };
    if (percentage >= 70) return { text: 'High Usage', color: '#f59e0b' };
    return { text: 'Normal', color: '#059669' };
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
      // Show success message based on action
      const action = newStatus === 'SUSPENDED' ? 'suspended' : 'activated';
      alert(`✓ Device ${action} successfully!`);
      window.location.reload();
    } catch (err) {
      alert('Failed to update device status: ' + (err.message || 'Unknown error'));
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

  const handleViewHistory = (device) => {
    // Navigate to history page with device pre-filtered
    navigate(`/history?deviceId=${device._id}&deviceName=${encodeURIComponent(device.name)}`);
  };

  const handleCopyServerInfo = async (server) => {
    if (!server) return;
    
    const serverInfo = [
      `Server Name: ${server.name || 'N/A'}`,
      `Host: ${server.host || 'N/A'}`,
      `VPN Type: ${server.vpnType || 'N/A'}`,
      `Region: ${server.region || 'N/A'}`,
      `Provider: ${server.provider || 'N/A'}`,
      `Status: ${server.isActive ? 'Active' : 'Inactive'}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(serverInfo);
      alert('Server information copied to clipboard!');
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = serverInfo;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('Server information copied to clipboard!');
      } catch (fallbackErr) {
        alert('Failed to copy to clipboard');
      }
      document.body.removeChild(textArea);
    }
  };

  // Check if user is admin or moderator
  const isAdminOrModerator = user && (user.role === 'admin' || user.role === 'moderator');

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
              <th>Type</th>
              <th>VPN IP</th>
              <th>Plan</th>
              <th>Usage</th>
              <th>Expires At</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => {
              // For Outline devices, use totalBytesUsed if available, otherwise sum sent+received
              const totalUsage = device.totalBytesUsed || 
                                 ((device.usage?.bytesSent || 0) + (device.usage?.bytesReceived || 0));
              const limit = device.dataLimit?.bytes || device.plan?.dataLimit?.bytes;
              const usagePercent = limit ? (totalUsage / limit) * 100 : 0;

              return (
                <tr key={device._id}>
                  <td>{device.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{device.server?.name || 'N/A'}</span>
                      {device.server && (
                        <button
                          className="btn-icon"
                          onClick={() => handleCopyServerInfo(device.server)}
                          title="Copy Server Info to Clipboard"
                          style={{
                            padding: '2px 6px',
                            fontSize: '12px',
                            minWidth: 'auto',
                            height: 'auto'
                          }}
                        >
                          📋
                        </button>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: device.server?.vpnType === 'wireguard' ? '#4CAF50' : '#FF9800',
                      color: 'white'
                    }}>
                      {device.server?.vpnType === 'wireguard' ? '🔷 WireGuard' : '🔶 Outline'}
                    </span>
                  </td>
                  <td>{device.vpnIp}</td>
                  <td>
                    {device.plan?.name || 'No Plan'}
                    {device.isUnlimited && ' (Unlimited)'}
                  </td>
                  <td>
                    <div className="usage-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500 }}>{formatBytes(totalUsage)}</span>
                        {device.limitInfo?.effectiveLimit && (
                          <span 
                            className="usage-status-badge"
                            style={{ 
                              backgroundColor: getUsageStatus(usagePercent).color + '15',
                              color: getUsageStatus(usagePercent).color,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '10px',
                              fontWeight: '600',
                              textTransform: 'uppercase'
                            }}
                          >
                            {Math.round(usagePercent)}%
                          </span>
                        )}
                      </div>
                      {device.limitInfo?.effectiveLimit && (
                        <>
                          <div className="usage-bar" style={{ marginBottom: '6px', position: 'relative' }}>
                            <div
                              className="usage-fill"
                              style={{ 
                                width: `${Math.min(usagePercent, 100)}%`,
                                background: `linear-gradient(90deg, ${getUsageBarColor(usagePercent)} 0%, ${getUsageBarColor(usagePercent)}dd 100%)`
                              }}
                            />
                            {usagePercent > 100 && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: '100%',
                                  width: '4px',
                                  height: '100%',
                                  backgroundColor: '#dc2626',
                                  borderRadius: '0 4px 4px 0'
                                }}
                              />
                            )}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <small style={{ fontSize: '11px', color: '#666' }}>
                              Limit: {formatBytes(device.limitInfo.effectiveLimit)}
                              {usagePercent > 100 && (
                                <span style={{ color: '#dc2626', fontWeight: '600', marginLeft: '4px' }}>
                                  (Exceeded by {formatBytes(totalUsage - device.limitInfo.effectiveLimit)})
                                </span>
                              )}
                            </small>
                            <small 
                              style={{ 
                                fontSize: '10px', 
                                color: getUsageStatus(usagePercent).color,
                                fontWeight: '600'
                              }}
                            >
                              {getUsageStatus(usagePercent).text}
                            </small>
                          </div>
                          {device.limitInfo.limitSource === 'device-override' && (
                            <small style={{ 
                              display: 'block', 
                              fontSize: '10px', 
                              color: '#667eea',
                              marginTop: '2px',
                              fontWeight: '500'
                            }}>
                              ⚙️ Device Override
                            </small>
                          )}
                          {usagePercent > 100 && (
                            <small style={{ 
                              display: 'block', 
                              fontSize: '10px', 
                              color: '#dc2626',
                              marginTop: '2px',
                              fontWeight: '600'
                            }}>
                              ⚠️ Limit exceeded - device should be suspended
                            </small>
                          )}
                          {usagePercent >= 90 && usagePercent <= 100 && device.status === 'ACTIVE' && (
                            <small style={{ 
                              display: 'block', 
                              fontSize: '10px', 
                              color: '#dc2626',
                              marginTop: '2px',
                              fontWeight: '600'
                            }}>
                              ⚠️ Near limit - may auto-pause soon
                            </small>
                          )}
                        </>
                      )}
                      {!device.limitInfo?.effectiveLimit && (
                        <small style={{ fontSize: '11px', color: '#059669', fontWeight: '500' }}>
                          ∞ Unlimited
                        </small>
                      )}
                    </div>
                  </td>
                  <td>{device.expiresAt ? new Date(device.expiresAt).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <span className={`status-badge status-${device.status?.toLowerCase()}`}>
                      {device.status}
                    </span>
                    {device.server?.vpnType !== 'outline' && (
                      <>
                        {device.isEnabled ? (
                          <span className="status-badge status-active">Enabled</span>
                        ) : (
                          <span className="status-badge status-disabled">Disabled</span>
                        )}
                      </>
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
                        onClick={() => handleViewHistory(device)}
                        title="View History"
                      >
                        📜
                      </button>
                      {isAdminOrModerator && (
                        <>
                          <button
                            className="btn-icon"
                            onClick={() => onEdit(device)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          {/* Suspend/Resume button for all VPN types */}
                          <button
                            className="btn-icon"
                            onClick={() => handleToggleStatus(device, device.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}
                            title={device.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          >
                            {device.status === 'ACTIVE' ? '⏸️' : '▶️'}
                          </button>
                          {/* Only show disconnect for WireGuard */}
                          {device.server?.vpnType !== 'outline' && (
                            <button
                              className="btn-icon"
                              onClick={() => handleDisconnect(device)}
                              title="Disconnect"
                            >
                              🔌
                            </button>
                          )}
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => onDelete(device._id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </>
                      )}
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

      {showHistory && selectedDevice && (
        <DeviceHistoryModal
          device={selectedDevice}
          onClose={() => {
            setShowHistory(false);
            setSelectedDevice(null);
          }}
        />
      )}
    </>
  );
};

export default DeviceList;
