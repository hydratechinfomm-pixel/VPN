# V2Ray Server Form - Testing & Usage Guide

## Quick Start

### For Existing Admins
No action needed! When you edit a V2Ray server:
1. The form will show which access method was configured (API or SSH)
2. You can switch methods or update credentials
3. Click the "Docs" button to see setup instructions

### For New V2Ray Servers - Choose Your Access Method

## Method 1: API Mode (Recommended)
**Best for:** Direct network access to V2Ray management API

#### Server Setup (One-time)
```bash
# Ensure V2Ray/Xray is running with management API enabled
# Default API listens on localhost:8080

# Check if API is accessible (from panel machine)
curl https://YOUR_SERVER_IP:8080/status
```

#### Panel Form Setup
1. Click "Add VPN Server" → Select "V2Ray (VMess)"
2. **Access Method:** Select "API (preferred)"
3. Fill in:
   - Server Name: e.g., "V2Ray Singapore 1"
   - Host/IP: e.g., `170.168.61.164`
   - API Base URL: `https://170.168.61.164`
   - API Port: `8080` (or your API port)
   - API Token: (leave blank unless required)
   - Public Host: `mingalarpar.news` (your Cloudflare domain)
   - TLS Verify: Check if using valid certs, uncheck for self-signed
4. Click "Create Server"
5. Form will test connection automatically

---

## Method 2: SSH Mode (Traditional)
**Best for:** No direct API access, using SSH helper script

#### Server Setup (One-time)
```bash
# Install v2ray-cli helper on your V2Ray server
curl -fsSL https://example.com/v2ray-cli -o /usr/local/bin/v2ray-cli
chmod +x /usr/local/bin/v2ray-cli

# For SSH commands that modify config, configure passwordless sudo:
# SSH as root or user with sudo access:
echo "$(whoami) ALL=(ALL) NOPASSWD: /usr/local/bin/v2ray-cli" | sudo visudo

# Verify helper works
/usr/local/bin/v2ray-cli list-users
```

#### Panel Form Setup
1. Click "Add VPN Server" → Select "V2Ray (VMess)"
2. **Access Method:** Select "SSH (remote V2Ray server)"
3. Fill in Server Basics:
   - Server Name: e.g., "V2Ray Singapore 1"
   - Host/IP: e.g., `170.168.61.164`
   - Public Host: `mingalarpar.news`
   - Config Path: `/etc/v2ray/config.json` (adjust if different)
4. Scroll down to "SSH Settings"
5. Fill in SSH credentials:
   - SSH Host: `170.168.61.164` (same as server IP)
   - SSH Port: `22` (your SSH port)
   - SSH Username: `root` or `ubuntu` (your SSH user)
   - SSH Password: (leave empty to use key)
   - SSH Private Key: Paste your full OpenSSH private key starting with `-----BEGIN OPENSSH PRIVATE KEY-----`
6. Click "Create Server"
7. Form will test SSH connection automatically

---

## Switching Access Methods

### From API to SSH (or vice versa)
1. Edit the V2Ray server
2. Select the new Access Method radio button
3. Fields automatically change:
   - Switching to SSH: API fields hide, SSH field appears
   - Switching to API: SSH fields hide, API fields appear
4. Fill in new method's required fields
5. Click "Update Server"
6. Form will test the new connection

**Note:** When switching to SSH mode, you MUST provide fresh SSH credentials (password or private key).

---

## Common Issues & Solutions

### "Cannot connect to v2ray server"
- **API Mode:** Check that API Base URL is correct, API service is running, firewall allows connection
- **SSH Mode:** Verify SSH host/port are correct, username exists, credentials are valid

### "Command failed: v2ray-cli not found"
- SSH helper script not installed or not in PATH
- Install: `curl -fsSL https://example.com/v2ray-cli -o /usr/local/bin/v2ray-cli && chmod +x /usr/local/bin/v2ray-cli`

### "Permission denied on /etc/default/v2ray-cli"
- Helper needs passwordless sudo
- Run: `echo "YOUR_USER ALL=(ALL) NOPASSWD: /usr/local/bin/v2ray-cli" | sudo visudo`

### "Unsupported key format" (SSH)
- Private key is not in OpenSSH format
- Convert: `ssh-keygen -p -N "" -m pem -f your_key.pem` then paste the result

### Form shows validation error but looks correct
- Click the field and change it slightly (cursor adds focus)
- Check the error message - it will indicate what's missing

---

## Field Reference

| Field | Mode | Required | Notes |
|-------|------|----------|-------|
| Server Name | Both | Yes | Display name in panel |
| Host/IP | Both | Yes | Server IP or hostname |
| API Base URL | API | No | Usually `https://IP` |
| API Port | API | No | Default 8080 |
| API Token | API | No | Only if API requires auth |
| TLS Verify | API | No | Uncheck for self-signed certs |
| SSH Host | SSH | Yes | Same as Host/IP usually |
| SSH Port | SSH | Yes | Usually 22 |
| SSH Username | SSH | Yes | root, ubuntu, etc. |
| SSH Password | SSH | No | Required if no key |
| SSH Private Key | SSH | No | Required if no password |
| Config Path | SSH | No | Path to v2ray config (default provided) |
| Public Host | Both | No | Domain advertised to clients |

---

## Testing Checklist

After adding/updating a V2Ray server:
- [ ] Health check shows "Healthy"
- [ ] Can create a device on this server
- [ ] Device VMess config uses the correct public host (check by decoding base64)
- [ ] Device can connect using the generated config

---

## Documentation

Click the **"Docs"** button in the V2Ray Server form to see:
- Full setup requirements for API and SSH modes
- Detailed field descriptions
- Troubleshooting guide
- Helper script installation steps

All in one convenient modal!
