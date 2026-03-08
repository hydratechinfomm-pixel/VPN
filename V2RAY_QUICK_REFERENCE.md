# V2Ray Setup - Quick Reference Card

**Print this or open in split view while working**

---

## 🚀 ONE-PAGE SETUP FLOW

```
Start
  ↓
SSH to 114.29.236.236
  ↓
Update system & install dependencies (5 min)
  ↓
Install Xray core (2 min)
  ↓
Create Xray config.json (2 min)
  ↓
Start Xray service (1 min)
  ↓
Generate SSL certificate (1 min)
  ↓
Install & configure Nginx (3 min)
  ↓
Install v2ray-cli tool (1 min)
  ↓
Test everything (5 min)
  ↓
Generate API token (save it!) (1 min)
  ↓
Add to panel database (5 min)
  ↓
Test panel ↔ server (5 min)
  ↓
✅ DONE - Server ready for production
```

**Total Time:** ~30 minutes

---

## 🔑 Critical Values

| Item | Value | Notes |
|------|-------|-------|
| Server IP | 114.29.236.236 | - |
| API Port | 443 (HTTPS) | Don't change |
| API Local | 127.0.0.1:8080 | Internal only |
| VMess Port | 10000 | Can customize |
| SSH Port | 22 | Standard |
| Xray Config | /usr/local/etc/xray/config.json | Don't move |
| SSL Cert | /etc/ssl/certs/xray-server.crt | Self-signed |
| SSL Key | /etc/ssl/private/xray-server.key | Self-signed |
| Nginx Config | /etc/nginx/sites-available/v2ray-api | After set token |
| v2ray-cli Path | /usr/local/bin/v2ray-cli | Must be executable |

---

## ⚡ Essential Commands

### SSH Login
```bash
ssh root@114.29.236.236
# If using key:
ssh -i ~/.ssh/your_key root@114.29.236.236
```

### System Check
```bash
whoami                    # Should be root
lsb_release -d           # Check OS version
ufw status               # Check firewall
```

### Service Control
```bash
sudo systemctl start xray     # Start Xray
sudo systemctl stop xray      # Stop Xray
sudo systemctl restart xray   # Restart Xray
sudo systemctl status xray    # Check status
sudo systemctl enable xray    # Auto-start on boot
```

### v2ray-cli Commands
```bash
v2ray-cli health                              # Check if working
v2ray-cli add-user --name "device-name"      # Add device
v2ray-cli remove-user "device-name"          # Remove device
v2ray-cli stats "device-name"                # Get usage
```

### Testing
```bash
# Config syntax
xray -test -config /usr/local/etc/xray/config.json

# API access (local)
xray api statsquery -pattern ""

# Nginx config
sudo nginx -t

# HTTPS endpoint (with token)
curl -k -H "Authorization: Bearer YOUR_TOKEN" https://114.29.236.236:443/health

# Port listening
sudo ss -tulpn | grep -E ':80|:443|:10000|:8080'
```

### Logs
```bash
# Xray errors
sudo tail -f /var/log/xray/error.log

# Xray access
sudo tail -f /var/log/xray/access.log

# Nginx errors
sudo tail -f /var/log/nginx/xray-api-error.log

# System service logs
sudo journalctl -u xray -f
```

---

## ✅ Verification Checklist

During setup, verify:

```
Phase 1: System Prep
☐ SSH access working
☐ System is updated
☐ Dependencies installed
☐ Firewall enabled with rules

Phase 2: Xray Install
☐ xray binary found (which xray)
☐ xray version shows (xray version)
☐ Config created at correct path
☐ Config valid (xray -test ...)

Phase 3: Services Running
☐ Xray running (systemctl status xray - active)
☐ Nginx running (systemctl status nginx - active)
☐ Port 8080 listening (Xray API)
☐ Port 10000 listening (VMess)
☐ Port 80/443 listening (Nginx)

Phase 4: v2ray-cli Working
☐ Script exists (which v2ray-cli)
☐ Executable (ls -l /usr/local/bin/v2ray-cli)
☐ Health check works (v2ray-cli health)
☐ Can add user (v2ray-cli add-user --name "test")

Phase 5: API/Nginx
☐ HTTPS endpoint responds
☐ Bearer token required
☐ Health endpoint works

Phase 6: Panel Integration
☐ Server in MongoDB
☐ API token saved
☐ Panel can connect to health
☐ Device creation works
☐ Client can connect
```

---

## 🛠️ Troubleshooting Quick Guide

**Problem** | **Check** | **Fix**
-----------|----------|-------
Can't SSH | Firewall port 22 | `sudo ufw allow 22/tcp`
Xray won't start | Config syntax | `xray -test -config ...`
Port already in use | What's on port | `sudo ss -tulpn | grep :10000`
Nginx error 502 | Is Xray API running | `xray api statsquery -pattern ""`
v2ray-cli not found | In PATH | `which v2ray-cli`
Device creation fails | Check logs | `sudo tail -f /var/log/xray/error.log`
Client can't connect | Firewall, config | `sudo ufw allow 10000/tcp`
Stats show 0 | Restart Xray | `sudo systemctl restart xray`

---

## 📊 Status Indicators

### Healthy Status
```
✅ Xray: active (running)
✅ Nginx: active (running)
✅ Ports: all listening
✅ v2ray-cli health: {"success":true,"status":"running"}
✅ API: responds to requests
✅ Logs: no error messages
```

### Problem Status
```
❌ Xray: inactive (dead)
❌ Nginx: error
❌ Ports: not listening
❌ v2ray-cli health: {"error":"..."}
❌ API: 502 Bad Gateway
❌ Logs: repeated error messages
```

---

## 🔐 Security Checklist

- [ ] Firewall is enabled
- [ ] Only necessary ports open (22, 80, 443, 10000)
- [ ] SSH key auth (not just password)
- [ ] API token is strong (32+ characters)
- [ ] HTTPS required for API (not HTTP)
- [ ] Self-signed cert for testing (get real cert for production)
- [ ] Log rotation configured
- [ ] Backups of config.json automated

---

## 📋 Panel Integration Values

When adding server to panel, use:

```json
{
  "name": "V2Ray Server - SG",
  "host": "114.29.236.236",
  "port": 10000,
  "vpnType": "v2ray",
  "region": "ASIA",
  "v2ray": {
    "accessMethod": "api",
    "apiBaseUrl": "https://114.29.236.236:443",
    "apiPort": 443,
    "apiToken": "YOUR_API_TOKEN_HERE",
    "tlsVerify": false,
    "publicHost": "114.29.236.236",
    "inboundsPort": 10000,
    "network": "tcp"
  }
}
```

**TOKEN:** Generate with `openssl rand -hex 32`

---

## 🔍 File Locations Quick Reference

```
/usr/local/bin/xray
    ↓ binary

/usr/local/etc/xray/config.json
    ↓ configuration

/var/log/xray/
    ├── error.log      ← Check for problems
    └── access.log     ← Connection logs

/etc/systemd/system/xray.service
    ↓ systemd service file

/usr/local/bin/v2ray-cli
    ↓ helper script

/etc/nginx/sites-available/v2ray-api
    ↓ nginx reverse proxy config

/etc/nginx/sites-enabled/v2ray-api
    ↓ symlink to enabled config

/etc/ssl/certs/xray-server.crt
    ↓ SSL certificate

/etc/ssl/private/xray-server.key
    ↓ SSL private key

/var/log/nginx/
    ├── xray-api-access.log
    └── xray-api-error.log
```

---

## 🎯 Success Indicators

You'll know setup is successful when:

1. ✅ Can SSH to server
2. ✅ `xray version` shows version number
3. ✅ `v2ray-cli health` returns success
4. ✅ `sudo systemctl status xray` shows "active"
5. ✅ `sudo ss -tulpn` shows all ports
6. ✅ `curl -k https://114.29.236.236/health -H "...token..."` responds
7. ✅ Add test device from panel
8. ✅ Device appears in `/usr/local/etc/xray/config.json`
9. ✅ Client can connect to VMess
10. ✅ Panel shows bandwidth usage

---

## 📞 Quick Help

**Installation stuck?**
→ See V2RAY_QUICK_SETUP.md

**Want to understand why?**
→ See V2RAY_API_MODE_SETUP_114.29.236.236.md

**Need to verify everything?**
→ See V2RAY_SETUP_MASTER_CHECKLIST.md

**Ready to add to panel?**
→ See V2RAY_PANEL_INTEGRATION_GUIDE.md

---

## ⏱️ Time Estimates

| Phase | Time |
|-------|------|
| System prep | 5 min |
| Xray install | 2 min |
| Config setup | 3 min |
| Nginx setup | 3 min |
| v2ray-cli | 2 min |
| Testing | 5 min |
| **Subtotal Setup** | **~20 min** |
| Panel integration | 10 min |
| **Total** | **~30 min** |

---

**Bookmark this page!** Save for quick reference during setup.

