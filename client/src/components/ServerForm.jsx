import React, { useState } from 'react';

const ServerForm = ({ server, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    // Basic info
    name: server?.name || '',
    description: server?.description || '',
    region: server?.region || '',
    provider: server?.provider || 'Custom',
    country: server?.country || '',
    city: server?.city || '',

    // Network
    host: server?.host || '',
    port: server?.wireguard?.port || server?.port || 51820,

    // WireGuard settings
    wireguardInterfaceName: server?.wireguard?.interfaceName || 'wg0',
    wireguardVpnIpRange: server?.wireguard?.vpnIpRange || '10.0.0.0/24',
    wireguardPort: server?.wireguard?.port || 51820,
    serverPublicKey: server?.wireguard?.serverPublicKey || '',

    // Access method
    accessMethod: server?.wireguard?.accessMethod || 'local', // 'local' or 'ssh'

    // SSH settings (for remote servers)
    sshHost: server?.wireguard?.ssh?.host || server?.host || '',
    sshPort: server?.wireguard?.ssh?.port || 22,
    sshUsername: server?.wireguard?.ssh?.username || '',
    sshPassword: '',
    sshPrivateKey: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
          ? value === ''
            ? ''
            : parseInt(value, 10)
          : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>{server ? 'Edit WireGuard Server' : 'Add WireGuard Server'}</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Basic server details */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Server Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g., Singapore WireGuard 1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="region">Region</label>
              <select
                id="region"
                name="region"
                value={formData.region}
                onChange={handleChange}
              >
                <option value="">Select Region (Optional)</option>
                <option value="US">United States</option>
                <option value="EU">Europe</option>
                <option value="ASIA">Asia</option>
                <option value="SOUTH_AMERICA">South America</option>
                <option value="AFRICA">Africa</option>
                <option value="OCEANIA">Oceania</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="provider">Provider</label>
              <select
                id="provider"
                name="provider"
                value={formData.provider}
                onChange={handleChange}
              >
                <option value="Custom">Custom</option>
                <option value="AWS">AWS</option>
                <option value="Google Cloud">Google Cloud</option>
                <option value="Azure">Azure</option>
                <option value="DigitalOcean">DigitalOcean</option>
                <option value="Linode">Linode</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="host">Host/IP Address *</label>
              <input
                type="text"
                id="host"
                name="host"
                value={formData.host}
                onChange={handleChange}
                required
                placeholder="e.g., 203.0.113.10 or vpn.example.com"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="country">Country</label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="e.g., Singapore"
              />
            </div>

            <div className="form-group">
              <label htmlFor="city">City</label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                placeholder="e.g., Singapore"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="2"
              placeholder="Short description of this WireGuard server (optional)"
            />
          </div>

          {/* WireGuard settings */}
          <h3>WireGuard Settings</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="wireguardInterfaceName">Interface Name *</label>
              <input
                type="text"
                id="wireguardInterfaceName"
                name="wireguardInterfaceName"
                value={formData.wireguardInterfaceName}
                onChange={handleChange}
                required
                placeholder="wg0"
              />
            </div>

            <div className="form-group">
              <label htmlFor="wireguardPort">WireGuard Port *</label>
              <input
                type="number"
                id="wireguardPort"
                name="wireguardPort"
                value={formData.wireguardPort}
                onChange={handleChange}
                required
                placeholder="51820"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="wireguardVpnIpRange">VPN IP Range *</label>
              <input
                type="text"
                id="wireguardVpnIpRange"
                name="wireguardVpnIpRange"
                value={formData.wireguardVpnIpRange}
                onChange={handleChange}
                required
                placeholder="10.0.0.0/24"
              />
              <small>Must match the Address range in /etc/wireguard/wg0.conf</small>
            </div>

            <div className="form-group">
              <label htmlFor="serverPublicKey">Server Public Key</label>
              <input
                type="text"
                id="serverPublicKey"
                name="serverPublicKey"
                value={formData.serverPublicKey}
                onChange={handleChange}
                placeholder="Paste from /etc/wireguard/server_public.key"
              />
              <small>Optional: if empty, the panel will attempt to detect/generate it.</small>
            </div>
          </div>

          {/* Access method */}
          <h3>Access Method</h3>
          <div className="form-group">
            <label>How should the panel access this WireGuard server? *</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  name="accessMethod"
                  value="local"
                  checked={formData.accessMethod === 'local'}
                  onChange={handleChange}
                />
                Local (WireGuard and panel on the same machine)
              </label>
              <label>
                <input
                  type="radio"
                  name="accessMethod"
                  value="ssh"
                  checked={formData.accessMethod === 'ssh'}
                  onChange={handleChange}
                />
                SSH (remote WireGuard server)
              </label>
            </div>
          </div>

          {formData.accessMethod === 'ssh' && (
            <>
              <h3>SSH Settings (for remote servers)</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sshHost">SSH Host *</label>
                  <input
                    type="text"
                    id="sshHost"
                    name="sshHost"
                    value={formData.sshHost}
                    onChange={handleChange}
                    required
                    placeholder="Server IP or hostname"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="sshPort">SSH Port *</label>
                  <input
                    type="number"
                    id="sshPort"
                    name="sshPort"
                    value={formData.sshPort}
                    onChange={handleChange}
                    required
                    placeholder="22"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sshUsername">SSH Username *</label>
                  <input
                    type="text"
                    id="sshUsername"
                    name="sshUsername"
                    value={formData.sshUsername}
                    onChange={handleChange}
                    required
                    placeholder="e.g., root or ubuntu"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="sshPassword">SSH Password (optional if using key)</label>
                  <input
                    type="password"
                    id="sshPassword"
                    name="sshPassword"
                    value={formData.sshPassword}
                    onChange={handleChange}
                    placeholder="Leave empty if using SSH key"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="sshPrivateKey">SSH Private Key (optional)</label>
                <textarea
                  id="sshPrivateKey"
                  name="sshPrivateKey"
                  value={formData.sshPrivateKey}
                  onChange={handleChange}
                  rows="4"
                  placeholder="Paste your SSH private key here if not using password"
                />
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : server ? 'Update Server' : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ServerForm;
