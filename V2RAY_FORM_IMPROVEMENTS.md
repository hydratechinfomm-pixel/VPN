# V2Ray Server Form Improvements - Implementation Summary

## ✅ Completed Improvements

### 1. **Form UX Enhancements**
- **API/SSH Field Separation**: When users select SSH mode, API fields (Base URL, Port, Token, TLS Verify) are hidden. When switching to API mode, SSH config path field is hidden.
- **Cleaner Interface**: Only relevant fields are shown based on the selected access method, reducing visual clutter.
- **Form Title**: Updated to show "Edit V2Ray Server" when editing a V2Ray server.

### 2. **SSH Credential Requirements**
- SSH Username, Host, Port are **required** when SSH mode is selected
- SSH Password **OR** SSH Private Key is required (at least one must be provided)
- Validation prevents save if credentials are incomplete on both create and update operations
- Same validation applies when **updating** SSH credentials during server edits

### 3. **Comprehensive Documentation Modal**
**Added "Docs" button** that opens a modal with setup instructions for:

#### API Mode Setup
- Requirements (V2Ray running, management API enabled)
- Panel form field mapping:
  - API Base URL: `https://your-server-ip`
  - API Port: Management API port (default 8080)
  - API Token: Optional authentication
  - TLS Verify: Certificate validation toggle
  - Public Host: Domain to advertise in VMess configs

#### SSH Mode Setup
- Requirements (SSH access, v2ray-cli helper)
- Helper script installation commands
- Panel form field mapping:
  - SSH Host: Server IP or hostname
  - SSH Port: SSH port (default 22)
  - SSH Username: Remote user (root, ubuntu, etc.)
  - SSH Password: Optional if using key auth
  - SSH Private Key: Full OpenSSH format key
  - Config Path: Path to v2ray config.json
  - Public Host: Domain for client advertisements

#### Troubleshooting Guide
- API connection failed → Check URL, port, firewall, service running
- SSH authentication failed → Check credentials, SSH host/port, key format
- v2ray-cli not found → Installation and path verification
- Permission denied → Configure passwordless sudo

### 4. **Error Display Improvements**
- All form validation errors are shown **in the modal** while editing
- Field-level errors appear next to relevant inputs
- Connection/health check errors from the server are displayed in the modal alert
- Users can see all issues before attempting to save

### 5. **Form Payload Generation**
- V2Ray server form correctly builds payloads with:
  - API mode: `v2rayApiBaseUrl`, `v2rayApiPort`, `v2rayApiToken`, `v2rayTlsVerify`
  - SSH mode: `sshHost`, `sshPort`, `sshUsername`, `sshPassword`, `sshPrivateKey`
  - Common: `v2rayPublicHost` (advertised domain to clients)
  - Common: `v2rayConfigPath` (path to config.json for SSH mode)
- Only relevant SSH fields are included when SSH mode is selected
- Only relevant API fields are included when API mode is selected

## 📋 Key Form Fields Reference

### For API Mode Access:
```
Server Name
Host/IP
V2Ray API Base URL  → https://your-server-ip
V2Ray API Port       → default 8080
V2Ray API Token      → optional
TLS Verify          → checkbox
Public Host         → mingalarpar.news (optional)
```

### For SSH Mode Access:
```
Server Name
Host/IP
SSH Host
SSH Port
SSH Username
SSH Password        → OR
SSH Private Key     → (at least one required)
V2Ray Config Path   → /etc/v2ray/config.json
Public Host         → mingalarpar.news (optional)
```

## 🔍 Testing Checklist

- [ ] Create V2Ray server with API mode → verify only API fields shown
- [ ] Create V2Ray server with SSH mode → verify only SSH fields shown
- [ ] Edit existing V2Ray server, switch from API to SSH → fields hide/show correctly
- [ ] Try saving SSH mode without credentials → get validation error
- [ ] Click "Docs" button → modal opens with setup instructions
- [ ] Close docs modal → returns to form
- [ ] Try invalid API URL → validation error displayed
- [ ] Try invalid Public Host → validation error displayed
- [ ] Create server with all required fields → success
- [ ] Update server with new SSH credentials → saved correctly

## 🚀 Deployment Notes

1. **No Backend Changes Required**: All improvements are frontend-only
2. **Backward Compatible**: Works with existing servers of all types
3. **Documentation**: Admin users can click "Docs" any time when editing V2Ray servers
4. **Error Handling**: Always shows connection errors in the modal, not in server list

## 📝 Files Modified

- `client/src/components/ServerForm.jsx`: All form improvements, docs modal, field hiding logic

## 🎯 Next Steps (Optional)

- Add similar documentation for WireGuard and Outline servers
- Add validation warning if publicHost differs from server host
- Add automated permission fixer with admin confirmation
- Add tests for form validation and payload generation
