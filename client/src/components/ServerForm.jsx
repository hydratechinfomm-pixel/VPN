import React, { useState } from 'react';

const ServerForm = ({ server, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    // Basic info
    name: server?.name || '',
    description: server?.description || '',
    vpnType: server?.vpnType || 'wireguard', // 'wireguard', 'outline' or 'v2ray'
    serverType: server?.serverType || 'REGULAR', // Server tier
    region: server?.region || '',
    provider: server?.provider || 'Custom',
    country: server?.country || '',
    city: server?.city || '',

    // Network
    host: server?.host || '',
    port: server?.port || (server?.vpnType === 'wireguard' ? 51820 : 443),

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

    // V2Ray settings
    v2rayApiPort: server?.v2ray?.apiPort || 8080,
    v2rayApiBaseUrl: server?.v2ray?.apiBaseUrl || server?.host || '',
    v2rayPublicHost: server?.v2ray?.publicHost || server?.host || server?.v2ray?.apiBaseUrl || '',
    v2rayApiToken: server?.v2ray?.apiToken || '',
    v2rayTlsVerify: server?.v2ray?.tlsVerify !== undefined ? server.v2ray.tlsVerify : true,
    v2rayAccessMethod: server?.v2ray?.accessMethod || 'api',
    v2rayConfigPath: server?.v2ray?.configPath || '/usr/local/etc/v2ray/config.json',
    // V2Ray Cloudflare proxy settings
    v2rayUseTls: server?.v2ray?.useTls || false,
    v2rayNetwork: server?.v2ray?.network || 'tcp',
    v2rayWsPath: server?.v2ray?.wsPath || '/vpn',
    v2raySni: server?.v2ray?.sni || server?.v2ray?.publicHost || '',
    v2rayAlpn: server?.v2ray?.alpn || 'h2,http/1.1',
    v2rayFingerprint: server?.v2ray?.fingerprint || 'chrome',

    // SSH settings (shared for all types)
    sshHost: server?.wireguard?.ssh?.host || server?.outline?.ssh?.host || server?.v2ray?.ssh?.host || server?.host || '',
    sshPort: server?.wireguard?.ssh?.port || server?.outline?.ssh?.port || server?.v2ray?.ssh?.port || 22,
    sshUsername: server?.wireguard?.ssh?.username || server?.outline?.ssh?.username || server?.v2ray?.ssh?.username || '',
    sshPassword: '',
    sshPrivateKey: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [useJsonImport, setUseJsonImport] = useState(false);
  const [jsonConfig, setJsonConfig] = useState('');
  const [showDocs, setShowDocs] = useState(false);

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

    // clear field-level error on change
    setFormErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
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

  const validateForm = () => {
    const errors = {};

    // Basic required fields
    if (!formData.name || !formData.name.trim()) errors.name = 'Server name is required';
    if (!formData.host || !formData.host.trim()) errors.host = 'Host/IP is required';
    if (!formData.port || formData.port < 1 || formData.port > 65535) {
      errors.port = 'Port must be between 1 and 65535';
    }

    // VPN-specific validation
    if (formData.vpnType === 'wireguard') {
      if (!formData.wireguardInterfaceName) errors.wireguardInterfaceName = 'Interface name is required';
      if (!formData.wireguardVpnIpRange) errors.wireguardVpnIpRange = 'VPN IP range is required';
      if (!formData.wireguardPort) errors.wireguardPort = 'WireGuard port is required';

      if (formData.wireguardAccessMethod === 'ssh') {
        if (!formData.sshHost) errors.sshHost = 'SSH host is required';
        if (!formData.sshPort) errors.sshPort = 'SSH port is required';
        if (!formData.sshUsername) errors.sshUsername = 'SSH username is required';
        if (!formData.sshPassword && !formData.sshPrivateKey) {
          errors.sshPrivateKey = 'Provide SSH password or private key';
        }
      }
    }

    if (formData.vpnType === 'outline') {
      if (!formData.outlineApiPort) errors.outlineApiPort = 'Outline API port is required';
      if (!formData.outlineAccessKeyPort) errors.outlineAccessKeyPort = 'Access key port is required';
      if (formData.outlineAccessMethod === 'api' && !formData.outlineAdminAccessKey) {
        errors.outlineAdminAccessKey = 'Admin access key is required for API access';
      }

      if (formData.outlineAccessMethod === 'ssh') {
        if (!formData.sshHost) errors.sshHost = 'SSH host is required';
        if (!formData.sshPort) errors.sshPort = 'SSH port is required';
        if (!formData.sshUsername) errors.sshUsername = 'SSH username is required';
        if (!formData.sshPassword && !formData.sshPrivateKey) {
          errors.sshPrivateKey = 'Provide SSH password or private key';
        }
      }
    }

    if (formData.vpnType === 'v2ray') {
      if (formData.v2rayAccessMethod === 'ssh') {
        if (!formData.sshHost) errors.sshHost = 'SSH host is required';
        if (!formData.sshPort) errors.sshPort = 'SSH port is required';
        if (!formData.sshUsername) errors.sshUsername = 'SSH username is required';
        // Only require password/key if creating or if user changed SSH host/username/port or filled one of the fields
        const isNew = !server;
        const sshFieldsChanged = isNew || formData.sshHost !== (server?.v2ray?.ssh?.host || server?.host) || formData.sshPort !== (server?.v2ray?.ssh?.port || 22) || formData.sshUsername !== (server?.v2ray?.ssh?.username || '');
        const anyCredentialFilled = formData.sshPassword || formData.sshPrivateKey;
        if ((isNew || sshFieldsChanged || anyCredentialFilled) && !formData.sshPassword && !formData.sshPrivateKey) {
          errors.sshPrivateKey = 'Provide SSH password or private key';
        }
      }

      if (formData.v2rayAccessMethod !== 'ssh' && formData.v2rayApiBaseUrl) {
        try {
          // basic URL validation
          // eslint-disable-next-line no-new
          new URL(formData.v2rayApiBaseUrl);
        } catch (err) {
          errors.v2rayApiBaseUrl = 'Invalid API Base URL';
        }
      }

      if (formData.v2rayPublicHost) {
        try {
          // validate as hostname by parsing with https:// prefix
          // eslint-disable-next-line no-new
          new URL('https://' + formData.v2rayPublicHost);
        } catch (err) {
          errors.v2rayPublicHost = 'Invalid public host';
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPayload = () => {
    const base = {
      name: formData.name,
      description: formData.description,
      host: formData.host,
      port: formData.port,
      vpnType: formData.vpnType,
      serverType: formData.serverType,
      region: formData.region,
      country: formData.country,
      city: formData.city,
      provider: formData.provider,
    };

    // SSH helper fields (top-level names expected by API)
    const sshFields = {
      sshHost: formData.sshHost,
      sshPort: formData.sshPort,
      sshUsername: formData.sshUsername,
      sshPassword: formData.sshPassword,
      sshPrivateKey: formData.sshPrivateKey,
    };

    if (formData.vpnType === 'wireguard') {
      return {
        ...base,
        wireguardInterfaceName: formData.wireguardInterfaceName,
        wireguardVpnIpRange: formData.wireguardVpnIpRange,
        wireguardPort: formData.wireguardPort,
        serverPublicKey: formData.serverPublicKey,
        wireguardAccessMethod: formData.wireguardAccessMethod,
        ...(formData.wireguardAccessMethod === 'ssh' ? sshFields : {}),
      };
    }

    if (formData.vpnType === 'outline') {
      return {
        ...base,
        outlineApiPort: formData.outlineApiPort,
        outlineAdminAccessKey: formData.outlineAdminAccessKey,
        outlineAccessKeyPort: formData.outlineAccessKeyPort,
        outlineCertSha256: formData.outlineCertSha256,
        outlineAccessMethod: formData.outlineAccessMethod,
        ...(formData.outlineAccessMethod === 'ssh' ? sshFields : {}),
      };
    }

    if (formData.vpnType === 'v2ray') {
      return {
        ...base,
        v2rayApiPort: formData.v2rayApiPort,
        v2rayApiBaseUrl: formData.v2rayApiBaseUrl,
        v2rayPublicHost: formData.v2rayPublicHost,
        v2rayApiToken: formData.v2rayApiToken,
        v2rayTlsVerify: formData.v2rayTlsVerify,
        v2rayAccessMethod: formData.v2rayAccessMethod,
        v2rayConfigPath: formData.v2rayConfigPath,
        // Cloudflare proxy settings
        v2rayUseTls: formData.v2rayUseTls,
        v2rayNetwork: formData.v2rayNetwork,
        v2rayWsPath: formData.v2rayWsPath,
        v2raySni: formData.v2raySni,
        v2rayAlpn: formData.v2rayAlpn,
        v2rayFingerprint: formData.v2rayFingerprint,
        ...(formData.v2rayAccessMethod === 'ssh' ? sshFields : {}),
      };
    }

    return base;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    const payload = buildPayload();

    setLoading(true);

    try {
      await onSubmit(payload);
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
            ? `Edit ${formData.vpnType === 'outline' ? 'Outline' : formData.vpnType === 'v2ray' ? 'V2Ray' : 'WireGuard'} Server`
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
                <label>
                  <input
                    type="radio"
                    name="vpnType"
                    value="v2ray"
                    checked={formData.vpnType === 'v2ray'}
                    onChange={handleChange}
                  />
                  <span>🟣 V2Ray (VMess)</span>
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
              {formErrors.name && (
                <div className="error-message" style={{ marginTop: '6px' }}>
                  {formErrors.name}
                </div>
              )}
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
              {formErrors.host && (
                <div className="error-message" style={{ marginTop: '6px' }}>
                  {formErrors.host}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="port">VPN Listen Port *</label>
              <input
                type="number"
                id="port"
                name="port"
                value={formData.port}
                onChange={handleChange}
                required
                min="1"
                max="65535"
                placeholder="443"
              />
              {formErrors.port && (
                <div className="error-message" style={{ marginTop: '6px' }}>
                  {formErrors.port}
                </div>
              )}
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
                  {formErrors.wireguardInterfaceName && (
                    <div className="error-message" style={{ marginTop: '6px' }}>
                      {formErrors.wireguardInterfaceName}
                    </div>
                  )}
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
                  {formErrors.wireguardPort && (
                    <div className="error-message" style={{ marginTop: '6px' }}>
                      {formErrors.wireguardPort}
                    </div>
                  )}
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
                  {formErrors.wireguardVpnIpRange && (
                    <div className="error-message" style={{ marginTop: '6px' }}>
                      {formErrors.wireguardVpnIpRange}
                    </div>
                  )}
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
                  {formErrors.outlineApiPort && (
                    <div className="error-message" style={{ marginTop: '6px' }}>
                      {formErrors.outlineApiPort}
                    </div>
                  )}
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
                  {formErrors.outlineAccessKeyPort && (
                    <div className="error-message" style={{ marginTop: '6px' }}>
                      {formErrors.outlineAccessKeyPort}
                    </div>
                  )}
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
                  required={formData.outlineAccessMethod === 'api'}
                />
                <small>Get this from your Outline server management interface</small>
                {formErrors.outlineAdminAccessKey && (
                  <div className="error-message" style={{ marginTop: '6px' }}>
                    {formErrors.outlineAdminAccessKey}
                  </div>
                )}
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

          {/* V2Ray settings */}
          {formData.vpnType === 'v2ray' && (
            <>
              <h3>V2Ray (VMess) Server Settings</h3>
              <button type="button" className="btn-secondary" style={{ float: 'right', marginBottom: 8 }} onClick={() => setShowDocs(true)}>
                Docs
              </button>

              {/* Hide API fields if SSH is selected, and vice versa */}
              {formData.v2rayAccessMethod !== 'ssh' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="v2rayApiBaseUrl">API Base URL</label>
                      <input
                        type="text"
                        id="v2rayApiBaseUrl"
                        name="v2rayApiBaseUrl"
                        value={formData.v2rayApiBaseUrl}
                        onChange={handleChange}
                        placeholder="e.g., https://1.2.3.4"
                      />
                      <small>Management API base URL for V2Ray helper (if available)</small>
                      {formErrors.v2rayApiBaseUrl && (
                        <div className="error-message" style={{ marginTop: '6px' }}>
                          {formErrors.v2rayApiBaseUrl}
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="v2rayApiPort">API Port</label>
                      <input
                        type="number"
                        id="v2rayApiPort"
                        name="v2rayApiPort"
                        value={formData.v2rayApiPort}
                        onChange={handleChange}
                        placeholder="8080"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="v2rayApiToken">API Token</label>
                      <input
                        type="text"
                        id="v2rayApiToken"
                        name="v2rayApiToken"
                        value={formData.v2rayApiToken}
                        onChange={handleChange}
                        placeholder="Optional API token for management API"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="v2rayTlsVerify">TLS Verify</label>
                    <div className="radio-group">
                      <label>
                        <input
                          type="checkbox"
                          id="v2rayTlsVerify"
                          name="v2rayTlsVerify"
                          checked={!!formData.v2rayTlsVerify}
                          onChange={handleChange}
                        />
                        <span>Verify TLS certificate when connecting to management API</span>
                      </label>
                    </div>
                    <small>Disable only for self-signed certs (not recommended)</small>
                  </div>
                </>
              )}

              {/* SSH-only fields */}
              {formData.v2rayAccessMethod === 'ssh' && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="v2rayConfigPath">Config Path (SSH mode)</label>
                    <input
                      type="text"
                      id="v2rayConfigPath"
                      name="v2rayConfigPath"
                      value={formData.v2rayConfigPath}
                      onChange={handleChange}
                      placeholder="/usr/local/etc/v2ray/config.json"
                    />
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="v2rayPublicHost">Public host (advertised to clients)</label>
                  <input
                    type="text"
                    id="v2rayPublicHost"
                    name="v2rayPublicHost"
                    value={formData.v2rayPublicHost}
                    onChange={handleChange}
                    placeholder="e.g., mingalarpar.news"
                  />
                  <small>Optional: domain to advertise in VMess configs (SNI / Cloudflare proxied host)</small>
                  {formErrors.v2rayPublicHost && (
                    <div className="error-message" style={{ marginTop: '6px' }}>
                      {formErrors.v2rayPublicHost}
                    </div>
                  )}
                </div>
              </div>

              <h3>Cloudflare Proxy / TLS Settings</h3>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="v2rayUseTls"
                    checked={!!formData.v2rayUseTls}
                    onChange={handleChange}
                  />
                  <span>Enable TLS (required for Cloudflare proxy)</span>
                </label>
                <small>Enables WebSocket + TLS for CF proxy compatibility</small>
              </div>

              {formData.v2rayUseTls && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="v2rayNetwork">Network Type</label>
                      <select
                        id="v2rayNetwork"
                        name="v2rayNetwork"
                        value={formData.v2rayNetwork}
                        onChange={handleChange}
                      >
                        <option value="tcp">TCP (direct)</option>
                        <option value="ws">WebSocket (CF proxy)</option>
                        <option value="grpc">gRPC</option>
                      </select>
                      <small>Use WebSocket for Cloudflare proxy</small>
                    </div>

                    {formData.v2rayNetwork === 'ws' && (
                      <div className="form-group">
                        <label htmlFor="v2rayWsPath">WebSocket Path</label>
                        <input
                          type="text"
                          id="v2rayWsPath"
                          name="v2rayWsPath"
                          value={formData.v2rayWsPath}
                          onChange={handleChange}
                          placeholder="/vpn"
                        />
                        <small>Default: /vpn</small>
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="v2raySni">SNI (Server Name Indication)</label>
                      <input
                        type="text"
                        id="v2raySni"
                        name="v2raySni"
                        value={formData.v2raySni}
                        onChange={handleChange}
                        placeholder="mingalarpar.news"
                      />
                      <small>Usually same as public host</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="v2rayFingerprint">Client Fingerprint</label>
                      <select
                        id="v2rayFingerprint"
                        name="v2rayFingerprint"
                        value={formData.v2rayFingerprint}
                        onChange={handleChange}
                      >
                        <option value="chrome">Chrome</option>
                        <option value="firefox">Firefox</option>
                        <option value="safari">Safari</option>
                        <option value="edge">Edge</option>
                        <option value="random">Random</option>
                      </select>
                      <small>Browser fingerprint for TLS</small>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="v2rayAlpn">ALPN (Application Layer Protocol)</label>
                    <input
                      type="text"
                      id="v2rayAlpn"
                      name="v2rayAlpn"
                      value={formData.v2rayAlpn}
                      onChange={handleChange}
                      placeholder="h2,http/1.1"
                    />
                    <small>Default: h2,http/1.1 (HTTP/2 and HTTP/1.1)</small>
                  </div>
                </>
              )}

              <h3>V2Ray Access Method</h3>
              <div className="form-group">
                <label>How should the panel access this V2Ray server? *</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name="v2rayAccessMethod"
                      value="api"
                      checked={formData.v2rayAccessMethod === 'api'}
                      onChange={handleChange}
                    />
                    <span>API (preferred)</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="v2rayAccessMethod"
                      value="ssh"
                      checked={formData.v2rayAccessMethod === 'ssh'}
                      onChange={handleChange}
                    />
                    <span>SSH (remote V2Ray server)</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {/* SSH settings (shared, shown if using SSH access) */}
          {((formData.vpnType === 'wireguard' && formData.wireguardAccessMethod === 'ssh') ||
            (formData.vpnType === 'outline' && formData.outlineAccessMethod === 'ssh') ||
            (formData.vpnType === 'v2ray' && formData.v2rayAccessMethod === 'ssh')) && (
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
                  {formErrors.sshHost && (
                    <div className="error-message" style={{ marginTop: '6px' }}>
                      {formErrors.sshHost}
                    </div>
                  )}
                  {formErrors.sshPort && (
                    <div className="error-message" style={{ marginTop: '6px' }}>
                      {formErrors.sshPort}
                    </div>
                  )}
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
                  {formErrors.sshUsername && (
                    <div className="error-message" style={{ marginTop: '6px' }}>
                      {formErrors.sshUsername}
                    </div>
                  )}
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
                {formErrors.sshPrivateKey && (
                  <div className="error-message" style={{ marginTop: '6px' }}>
                    {formErrors.sshPrivateKey}
                  </div>
                )}
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

        {/* V2Ray Documentation Modal */}
        {showDocs && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.5)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '700px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              <h3>V2Ray Server Setup Documentation</h3>
              
              <h4>📋 API Mode Setup (Recommended)</h4>
              <p><strong>Requirements:</strong></p>
              <ul>
                <li>V2Ray/Xray running on the server</li>
                <li>Management API enabled (port 8080 by default)</li>
                <li>Network access from panel to API port</li>
              </ul>
              <p><strong>Panel Form Fields:</strong></p>
              <ul>
                <li><strong>API Base URL:</strong> https://your-server-ip (e.g., https://170.168.61.164)</li>
                <li><strong>API Port:</strong> Management API port (default: 8080)</li>
                <li><strong>API Token:</strong> Optional authentication token (if your API requires it)</li>
                <li><strong>TLS Verify:</strong> Check if using valid certificates; uncheck for self-signed</li>
                <li><strong>Public host:</strong> Domain to advertise in VMess configs (e.g., mingalarpar.news)</li>
              </ul>

              <h4>🔐 SSH Mode Setup</h4>
              <p><strong>Requirements:</strong></p>
              <ul>
                <li>SSH access to the V2Ray server</li>
                <li>v2ray-cli helper script installed on server: /usr/local/bin/v2ray-cli</li>
                <li>Helper script must be executable and have proper permissions</li>
                <li>Passwordless sudo recommended for helper operations</li>
              </ul>
              <p><strong>Helper Script Installation:</strong></p>
              <pre style={{ backgroundColor: '#f3f4f6', padding: '0.75rem', borderRadius: '4px', overflow: 'auto' }}>
{`curl -fsSL https://example.com/v2ray-cli -o /usr/local/bin/v2ray-cli
chmod +x /usr/local/bin/v2ray-cli
# For sudo commands without password:
echo "root ALL=(ALL) NOPASSWD: /usr/local/bin/v2ray-cli" | visudo`}
              </pre>

              <p><strong>Panel Form Fields (SSH Mode):</strong></p>
              <ul>
                <li><strong>SSH Host:</strong> Server IP or hostname (e.g., 170.168.61.164)</li>
                <li><strong>SSH Port:</strong> SSH port (default: 22)</li>
                <li><strong>SSH Username:</strong> Remote user (e.g., root, ubuntu)</li>
                <li><strong>SSH Password:</strong> Password or leave empty for key auth</li>
                <li><strong>SSH Private Key:</strong> Full OpenSSH private key (-----BEGIN OPENSSH PRIVATE KEY-----...)</li>
                <li><strong>Config Path:</strong> Path to v2ray config.json (e.g., /etc/v2ray/config.json)</li>
                <li><strong>Public host:</strong> Domain to advertise in VMess configs</li>
              </ul>

              <h4>🔍 Troubleshooting</h4>
              <dl style={{ fontSize: '0.9rem' }}>
                <dt><strong>API connection failed:</strong></dt>
                <dd>Verify API Base URL and port are correct; check firewall; ensure API service is running</dd>
                <dt><strong>SSH authentication failed:</strong></dt>
                <dd>Check SSH credentials, verify SSH host/port, ensure private key format is OpenSSH</dd>
                <dt><strong>v2ray-cli not found:</strong></dt>
                <dd>Install the helper script on the server; ensure it's in /usr/local/bin and executable</dd>
                <dt><strong>Permission denied on /etc/default/v2ray-cli:</strong></dt>
                <dd>Configure passwordless sudo for the v2ray-cli command</dd>
              </dl>

              <button 
                type="button" 
                onClick={() => setShowDocs(false)} 
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServerForm;
