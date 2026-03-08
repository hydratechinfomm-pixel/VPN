# V2Ray Server Setup & Panel Integration - Master Checklist

**Server IP:** 114.29.236.236  
**API Port:** 443 (HTTPS)  
**VMess Port:** 10000  
**Status:** Ready for Setup

---

## 📋 PHASE 1: SERVER SETUP (Run on V2Ray Server)

### 1.1 Initial Access & Verification
- [ ] SSH into server: `ssh root@114.29.236.236`
- [ ] Verify root access: `whoami` → should show "root"
- [ ] Check OS: `lsb_release -d` → Ubuntu 20.04+ or Debian 11+
- [ ] Verify internet: `ping 8.8.8.8`

### 1.2 System Preparation
- [ ] Update system: `sudo apt-get update && sudo apt-get upgrade -y`
- [ ] Install dependencies: `sudo apt-get install -y curl wget git unzip jq openssl ufw htop net-tools`
- [ ] Verify jq: `jq --version` → should be 1.6+
- [ ] Create log directory: `sudo mkdir -p /var/log/xray && sudo chmod 755 /var/log/xray`

### 1.3 Firewall Configuration
- [ ] Enable UFW: `sudo ufw enable`
- [ ] Allow SSH: `sudo ufw allow 22/tcp`
- [ ] Allow HTTP: `sudo ufw allow 80/tcp`
- [ ] Allow HTTPS: `sudo ufw allow 443/tcp`
- [ ] Allow VMess: `sudo ufw allow 10000/tcp`
- [ ] Verify firewall: `sudo ufw status` → should show all rules

### 1.4 Install Xray/V2Ray Core
- [ ] Run installer: `bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install`
- [ ] Verify installation: `xray version` → should show version info
- [ ] Check binary location: `which xray` → should be `/usr/local/bin/xray`

### 1.5 Xray Configuration
- [ ] Create config file: `/usr/local/etc/xray/config.json` (use script from QUICK_SETUP.md)
- [ ] Validate config: `xray -test -config /usr/local/etc/xray/config.json` → "Configuration OK"
- [ ] Start service: `sudo systemctl daemon-reload && sudo systemctl enable xray && sudo systemctl start xray`
- [ ] Verify running: `sudo systemctl status xray` → should show "active (running)"
- [ ] Test API: `xray api statsquery -pattern ""` → should return JSON

### 1.6 SSL Certificate
- [ ] Generate self-signed cert (if IP-only):
  ```bash
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/private/xray-server.key \
    -out /etc/ssl/certs/xray-server.crt \
    -subj "/CN=114.29.236.236/O=VPN/C=SG"
  ```
- [ ] Verify cert exists: `sudo ls -la /etc/ssl/certs/xray-server.crt`

### 1.7 Nginx Installation & Configuration
- [ ] Install Nginx: `sudo apt-get install -y nginx`
- [ ] Create config file: `/etc/nginx/sites-available/v2ray-api` (use script from QUICK_SETUP.md)
- [ ] Enable site: `sudo ln -s /etc/nginx/sites-available/v2ray-api /etc/nginx/sites-enabled/`
- [ ] Disable default: `sudo rm -f /etc/nginx/sites-enabled/default`
- [ ] Test config: `sudo nginx -t` → "test is successful"
- [ ] Enable and start: `sudo systemctl enable nginx && sudo systemctl start nginx`
- [ ] Verify running: `sudo systemctl status nginx` → "active (running)"
- [ ] Check ports: `sudo ss -tulpn | grep -E 'nginx|:80|:443'` → should show both listening

### 1.8 Install v2ray-cli Helper Tool
- [ ] Create script: `/usr/local/bin/v2ray-cli` (use script from QUICK_SETUP.md)
- [ ] Make executable: `sudo chmod +x /usr/local/bin/v2ray-cli`
- [ ] Verify in PATH: `which v2ray-cli` → `/usr/local/bin/v2ray-cli`

---

## 🧪 PHASE 2: TESTING (On V2Ray Server)

### 2.1 Service Health Checks
- [ ] Xray running: `sudo systemctl status xray` → "active (running)"
- [ ] Nginx running: `sudo systemctl status nginx` → "active (running)"
- [ ] Port 8080 (API): `sudo ss -tulpn | grep 8080` → listening on 127.0.0.1:8080
- [ ] Port 10000 (VMess): `sudo ss -tulpn | grep 10000` → listening on 0.0.0.0:10000
- [ ] Ports 80/443: `sudo ss -tulpn | grep -E ':80|:443'` → both listening

### 2.2 v2ray-cli Tests
- [ ] Health check: `v2ray-cli health` → `{"success":true,"status":"running"}`
- [ ] Create test user: `v2ray-cli add-user --name "test-device"` → returns UUID
- [ ] Verify in config: `sudo jq '.inbounds[0].settings.clients[0] | {id, email}' /usr/local/etc/xray/config.json`
- [ ] Query stats: `v2ray-cli stats "test-device"` → returns JSON or empty
- [ ] Remove test user: `v2ray-cli remove-user "test-device"` → `{"success":true}`
- [ ] Verify removed: `sudo jq '.inbounds[0].settings.clients | length' /usr/local/etc/xray/config.json` → 0

### 2.3 Xray API Tests
- [ ] Direct API call: `xray api statsquery -pattern ""` → returns JSON
- [ ] API listening: `curl http://127.0.0.1:8080/ 2>&1 | head -20` → connects (or shows connection details)

### 2.4 Nginx/HTTPS Tests
- [ ] HTTP redirect: `curl -I http://114.29.236.236/ | head -3` → shows 301 redirect
- [ ] HTTPS health: `curl -k https://114.29.236.236/health` → `{"status":"ok"}`
- [ ] Config validation: `sudo nginx -t` → "test is successful"

### 2.5 Generate API Token
- [ ] Generate token: `openssl rand -hex 32`
- [ ] **Save this token somewhere secure!** (You'll need it for panel integration)
- [ ] Update Nginx: `sudo sed -i 's/set \$api_token "YOUR_API_TOKEN_HERE"/set \$api_token "YOUR_REAL_TOKEN_HERE"/' /etc/nginx/sites-available/v2ray-api`
- [ ] Verify: `sudo grep "set \$api_token" /etc/nginx/sites-available/v2ray-api`
- [ ] Test Nginx: `sudo nginx -t`
- [ ] Reload Nginx: `sudo systemctl reload nginx`

### 2.6 Test with Real Token
- [ ] Set token in variable: `export API_TOKEN="YOUR_TOKEN_HERE"`
- [ ] Test health: `curl -k -H "Authorization: Bearer $API_TOKEN" https://114.29.236.236:443/health` → `{"status":"ok"}`
- [ ] Test without token (should fail): `curl -k https://114.29.236.236:443/api` → 401 Unauthorized

### 2.7 Final Server Test Report
Run this:
```bash
echo "=== FINAL V2RAY SERVER TEST REPORT ===" && \
echo "Date: $(date)" && \
echo "" && \
echo "Services:" && \
sudo systemctl status xray nginx --no-pager | grep Active && \
echo "" && \
echo "Listening Ports:" && \
sudo ss -tulpn | grep -E 'xray|nginx|:8080|:10000|:80|:443' && \
echo "" && \
echo "v2ray-cli Health:" && \
v2ray-cli health && \
echo "" && \
echo "Xray Config:" && \
xray -test -config /usr/local/etc/xray/config.json
```
- [ ] All services active
- [ ] All ports listening correctly
- [ ] Health check shows success
- [ ] Config is valid

---

## 📝 PHASE 3: PANEL INTEGRATION

### 3.1 Panel Database Setup
- [ ] Connect to MongoDB: `mongosh` (or `mongo`)
- [ ] Select database: `use vpn_panel` (or your database name)
- [ ] Insert server document (use script from PANEL_INTEGRATION_GUIDE.md):
  ```bash
  db.vpnservers.insertOne({
    "name": "V2Ray Server - SG",
    "host": "114.29.236.236",
    "port": 10000,
    "vpnType": "v2ray",
    "region": "ASIA",
    "country": "Singapore",
    "city": "Singapore",
    "provider": "Custom",
    "isActive": true,
    "v2ray": {
      "accessMethod": "api",
      "apiBaseUrl": "https://114.29.236.236:443",
      "apiPort": 443,
      "apiToken": "YOUR_API_TOKEN_HERE",
      "tlsVerify": false,
      "publicHost": "114.29.236.236",
      "inboundsPort": 10000,
      "useTls": false,
      "network": "tcp"
    },
    "stats": {
      "totalUsers": 0,
      "totalDataTransferred": 0,
      "uptime": 100,
      "isHealthy": true,
      "lastHealthCheck": new Date()
    },
    "createdAt": new Date(),
    "updatedAt": new Date()
  })
  ```
- [ ] Verify insertion: `db.vpnservers.findOne({host: "114.29.236.236"})` → should return your object

### 3.2 Test Panel ↔ Server Connection
From your panel machine:
- [ ] Test health endpoint: 
  ```bash
  curl -k -H "Authorization: Bearer YOUR_API_TOKEN" https://114.29.236.236:443/health
  ```
  → Should return `{"status":"ok"}`

### 3.3 Create Test Device via Panel
- [ ] Open panel admin UI or API
- [ ] Create new device:
  - Server: V2Ray Server - SG
  - User: (any user)
  - Plan: (any plan)
  - Device Name: "test-device-integration"
- [ ] Device creation succeeds (UUID generated)
- [ ] VMess config is shown/downloadable
- [ ] QR code is generated

### 3.4 Verify Device on Server
SSH to 114.29.236.236:
- [ ] Device shows in config: `sudo jq '.inbounds[0].settings.clients[] | {id, email}' /usr/local/etc/xray/config.json`
- [ ] Device email matches device name from panel

### 3.5 Test Client Connection
- [ ] Get VMess URL/QR from panel
- [ ] Import to V2Ray client (v2rayNG, Qv2ray, etc.)
- [ ] Start connection
- [ ] Visit https://ip.sb to verify VPN IP is 114.29.236.236
- [ ] Generate some traffic (download/upload)
- [ ] Check panel shows bandwidth usage (wait 5 minutes for stats to update)

### 3.6 Clean Up Test Device
- [ ] Delete test device from panel
- [ ] Verify device is removed from server config: `sudo jq '.inbounds[0].settings.clients' /usr/local/etc/xray/config.json`

---

## ✅ PRE-PRODUCTION CHECKLIST

### Security
- [ ] API token is strong (32+ characters)
- [ ] API token stored securely in panel database  
- [ ] HTTPS/TLS is required for all API calls
- [ ] Firewall restricts SSH to your IP (optional but recommended)
- [ ] SSH uses key auth instead of password (optional but recommended)

### Performance
- [ ] Xray service auto-starts on reboot: `sudo systemctl is-enabled xray` → enabled
- [ ] Nginx service auto-starts on reboot: `sudo systemctl is-enabled nginx` → enabled
- [ ] Log rotation configured (prevent disk fill): Check `/etc/logrotate.d/`
- [ ] Server has adequate resources (RAM, CPU, bandwidth)

### Monitoring & Maintenance
- [ ] Set up server health monitoring
- [ ] Configure log retention and rotation
- [ ] Plan automated backups of `/usr/local/etc/xray/config.json`
- [ ] Document API token securely (password manager)
- [ ] Schedule monthly Xray updates

### Documentation
- [ ] Record API token securely
- [ ] Document server IP and ports
- [ ] Save Xray config backup
- [ ] Document any customizations made

---

## 📊 FINAL VERIFICATION COMMANDS

Run these commands to verify everything is working:

```bash
# From your panel machine
API_TOKEN="YOUR_API_TOKEN_HERE"

# 1. Can reach server?
ping 114.29.236.236

# 2. Can reach API?
curl -k -H "Authorization: Bearer $API_TOKEN" https://114.29.236.236:443/health

# 3. Server in database?
mongosh vpn_panel --eval "db.vpnservers.countDocuments({host: '114.29.236.236'})"

# 4. Can create device? (via API or UI)
# Test manually - should succeed
```

```bash
# On V2Ray server (114.29.236.236)

# 1. All services running?
sudo systemctl status xray nginx | grep -i active

# 2. All ports listening?
sudo ss -tulpn | grep -E ':80|:443|:10000|:8080'

# 3. Config valid?
xray -test -config /usr/local/etc/xray/config.json

# 4. API working?
v2ray-cli health

# 5. Any errors?
sudo tail -20 /var/log/xray/error.log | grep -i error || echo "No recent errors"
```

---

## 🚀 DEPLOYMENT SUMMARY

**Status After Completion:** ✅ PRODUCTION READY

### What You Have:
1. ✅ V2Ray/Xray server running on 114.29.236.236
2. ✅ API accessible via HTTPS on port 443
3. ✅ VMess inbound on port 10000 for client connections
4. ✅ v2ray-cli tool for device management
5. ✅ Server integrated with your VPN panel
6. ✅ Device creation working end-to-end
7. ✅ Client connections working
8. ✅ Bandwidth tracking functional

### Next Steps:
1. Create production users/devices via panel
2. Scale clients and monitor usage
3. Set up automated monitoring alerts
4. Configure log rotation and backups
5. Plan capacity expansion if needed

### Estimated Total Time:
- Server setup: **~20 minutes**
- Testing: **~10 minutes**
- Panel integration: **~10 minutes**
- **Total: ~40 minutes**

---

## 📞 TROUBLESHOOTING QUICK REFERENCE

| Problem | Check | Solution |
|---------|-------|----------|
| Can't SSH to server | Firewall, IP routing | Verify IP is correct, allow port 22 |
| Xray won't start | Config syntax, permissions | Run `xray -test -config ...`, check logs |
| API unreachable | Nginx, cert, ports | Check `sudo ss -tulpn`, restart nginx |
| Device creation fails | v2ray-cli, permissions | Run `v2ray-cli health`, check SSH access |
| Stats show 0 | Config stats block, restart | Verify policy.levels in config, restart xray |
| Client can't connect | Firewall, port, config | Check port 10000 listening, verify UUID in config |
| HTTPS cert errors | Self-signed cert, tlsVerify | Use `-k` flag in curl, set tlsVerify: false in panel |

For detailed troubleshooting, see:
- [V2RAY_API_MODE_SETUP_114.29.236.236.md](V2RAY_API_MODE_SETUP_114.29.236.236.md) - Full setup guide with detailed troubleshooting
- [V2RAY_QUICK_SETUP.md](V2RAY_QUICK_SETUP.md) - Quick reference with copy-paste commands
- [V2RAY_PANEL_INTEGRATION_GUIDE.md](V2RAY_PANEL_INTEGRATION_GUIDE.md) - Panel integration and testing

---

**Last Updated:** February 2026  
**Setup Version:** 1.0  
**Status:** Ready for Production

