import React, { useState } from 'react';

const ServerForm = ({ server, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    // Basic info
    name: server?.name || '',
    description: server?.description || '',
    vpnType: server?.vpnType || 'wireguard', // 'wireguard' or 'outline'
    serverType: server?.serverType || 'REGULAR', // Server tier
    region: server?.region || '',
    provider: server?.provider || 'Custom',
    country: server?.country || '',
    city: server?.city || '',

    // Network
    host: server?.host || '',
    port: server?.port || (server?.vpnType === 'outline' ? 443 : 51820),

    // WireGuard settings
    wireguardInterfaceName: server?.wireguard?.interfaceName || 'wg0',
    wireguardVpnIpRange: server?.wireguard?.vpnIpRange || '10.0.0.0/24',
    wireguardPort: server?.wireguard?.port || 51820,
    serverPublicKey: server?.wireguard?.serverPublicKey || '',
    wireguardAccessMethod: server?.wireguard?.accessMethod || 'local',

    // Outline settings
    outlineApiPort: server?.outline?.apiPort || 8081,
    outlineAdminAccessKey: server?.outline?.adminAccessKey || '',
    outlineAccessKeyPort: server?.outline?.accessKeyPort || 8388,
    outlineCertSha256: server?.outline?.certSha256 || '',
    outlineAccessMethod: server?.outline?.accessMethod || 'api',

    // SSH settings (shared for both)
    sshHost: server?.wireguard?.ssh?.host || server?.outline?.ssh?.host || server?.host || '',
    sshPort: server?.wireguard?.ssh?.port || server?.outline?.ssh?.port || 22,
    sshUsername: server?.wireguard?.ssh?.username || server?.outline?.ssh?.username || '',
    sshPassword: '',
    sshPrivateKey: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useJsonImport, setUseJsonImport] = useState(false);
  const [jsonConfig, setJsonConfig] = useState('');

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

  const handleJsonImport = () => {
    try {
      const config = JSON.parse(jsonConfig);

      if (!config.apiUrl) {
        setError('JSON must contain an "apiUrl" field');
        return;
      }

      // Parse apiUrl to extract host, port, and admin key
      // Format: https://host:port/adminKey or https://host/adminKey (default port 8081)
      const url = new URL(config.apiUrl);
      const host = url.hostname;
      const port = url.port ? parseInt(url.port, 10) : 8081;
      const adminKey = url.pathname
        .replace(/^\//g, '')
        .split('/')[0];

      // Update form data with parsed values
      setFormData((prev) => ({
        ...prev,
        host: host || prev.host,
        outlineApiPort: port || 8081,
        outlineAdminAccessKey: adminKey || '',
        outlineCertSha256: config.certSha256 || prev.outlineCertSha256,
      }));

      setError('');
      setUseJsonImport(false);
      setJsonConfig('');
    } catch (err) {
      setError(`Failed to parse JSON: ${err.message}`);
    }
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
        <h2>
          {server
            ? `Edit ${formData.vpnType === 'outline' ? 'Outline' : 'WireGuard'} Server`
            : 'Add VPN Server'}
        </h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* VPN Type selector (only for new servers) */}
          {!server && (
            <div className="form-group">
              <label>VPN Type *</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    name="vpnType"
                    value="wireguard"
                    checked={formData.vpnType === 'wireguard'}
                    onChange={handleChange}
                  />
                  <span>🔷 WireGuard (Peer-to-peer protocol)</span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="vpnType"
                    value="outline"
                    checked={formData.vpnType === 'outline'}
                    onChange={handleChange}
                  />
                  <span>🔶 Outline (Easy-to-use VPN platform)</span>
                </label>
              </div>
            </div>
          )}

          {/* Server Type selector */}
          <div className="form-group">
            <label htmlFor="serverType">Server Type *</label>
            <select
              id="serverType"
              name="serverType"
              value={formData.serverType}
              onChange={handleChange}
              required
            >
              <option value="REGULAR">Regular (Standard servers)</option>
              <option value="PREMIUM">Premium (High-performance servers)</option>
              <option value="ENTERPRISE">Enterprise (Dedicated servers)</option>
            </select>
            <small>Choose the server tier/category for this VPN server</small>
          </div>

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
                placeholder="e.g., Singapore VPN 1"
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
              placeholder="Short description of this VPN server (optional)"
            />
          </div>

          {/* WireGuard settings */}
          {formData.vpnType === 'wireguard' && (
            <>
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

              <h3>WireGuard Access Method</h3>
              <div className="form-group">
                <label>How should the panel access this WireGuard server? *</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="wireguardAccessMethod"
                      value="local"
                      checked={formData.wireguardAccessMethod === 'local'}
                      onChange={handleChange}
                    />
                    <span>Local (WireGuard and panel on same machine)</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="wireguardAccessMethod"
                      value="ssh"
                      checked={formData.wireguardAccessMethod === 'ssh'}
                      onChange={handleChange}
                    />
                    <span>SSH (remote WireGuard server)</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* Outline settings */}
          {formData.vpnType === 'outline' && (
            <>
              <h3>Outline Server Settings</h3>

              {/* JSON Import Section */}
              <div className="radio-group">
                <label>
                  <input
                    type="checkbox"
                    checked={useJsonImport}
                    onChange={(e) => setUseJsonImport(e.target.checked)}
                  />
                  Import from Outline Manager JSON Config
                </label>
              </div>

              {useJsonImport && (
                <div className="form-group">
                  <label htmlFor="jsonConfig">
                    Paste JSON Config from Outline Manager
                  </label>
                  <textarea
                    id="jsonConfig"
                    value={jsonConfig}
                    onChange={(e) => setJsonConfig(e.target.value)}
                    rows="4"
                    placeholder='Example: {"apiUrl":"https://11.1.1.1:13069/asdfsf","certSha256":"..."}'
                  />
                  <small>
                    Find this in Outline Manager under Server Settings &gt; Management API URL
                  </small>
                  <button
                    type="button"
                    onClick={handleJsonImport}
                    className="btn btn-secondary"
                    style={{ marginTop: '10px' }}
                  >
                    Import Settings
                  </button>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="outlineApiPort">Management API Port *</label>
                  <input
                    type="number"
                    id="outlineApiPort"
                    name="outlineApiPort"
                    value={formData.outlineApiPort}
                    onChange={handleChange}
                    required
                    placeholder="8081"
                  />
                  <small>Default: 8081</small>
                </div>

                <div className="form-group">
                  <label htmlFor="outlineAccessKeyPort">Access Key Port *</label>
                  <input
                    type="number"
                    id="outlineAccessKeyPort"
                    name="outlineAccessKeyPort"
                    value={formData.outlineAccessKeyPort}
                    onChange={handleChange}
                    required
                    placeholder="8388"
                  />
                  <small>Default: 8388</small>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="outlineAdminAccessKey">Admin Access Key *</label>
                <input
                  type="password"
                  id="outlineAdminAccessKey"
                  name="outlineAdminAccessKey"
                  value={formData.outlineAdminAccessKey}
                  onChange={handleChange}
                  placeholder="Paste admin access key from Outline server"
                />
                <small>Get this from your Outline server management interface</small>
              </div>

              <div className="form-group">
                <label htmlFor="outlineCertSha256">Certificate SHA256 (optional)</label>
                <input
                  type="text"
                  id="outlineCertSha256"
                  name="outlineCertSha256"
                  value={formData.outlineCertSha256}
                  onChange={handleChange}
                  placeholder="Leave empty for self-signed certificates"
                />
              </div>

              <h3>Outline Access Method</h3>
              <div className="form-group">
                <label>How should the panel access the Outline server? *</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="outlineAccessMethod"
                      value="api"
                      checked={formData.outlineAccessMethod === 'api'}
                      onChange={handleChange}
                    />
                    <span>API (Direct API calls)</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="outlineAccessMethod"
                      value="ssh"
                      checked={formData.outlineAccessMethod === 'ssh'}
                      onChange={handleChange}
                    />
                    <span>SSH (Remote server via SSH)</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* SSH settings (shared, shown if using SSH access) */}
          {((formData.vpnType === 'wireguard' && formData.wireguardAccessMethod === 'ssh') ||
            (formData.vpnType === 'outline' && formData.outlineAccessMethod === 'ssh')) && (
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
