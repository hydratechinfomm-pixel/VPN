# Adding V2Ray Server to Panel - Complete Guide

**Server:** 114.29.236.236 (API Mode, HTTPS Port 443)  
**After:** V2Ray server setup is complete and tested

---

## Part 1: Panel Database Configuration

### Option 1: Using MongoDB Directly

If you have direct MongoDB access:

```bash
# Connect to MongoDB
mongosh

# Select panel database (replace with your actual database name)
use vpn_panel

# Insert V2Ray server document
db.vpnservers.insertOne({
  "name": "V2Ray Server - SG",
  "description": "Xray/V2Ray server running API mode on HTTPS port 443",
  "host": "114.29.236.236",
  "port": 10000,
  "vpnType": "v2ray",
  "region": "ASIA",
  "country": "Singapore",
  "city": "Singapore",
  "provider": "Custom",
  "serverType": "REGULAR",
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
    "network": "tcp",
    "wsPath": "/vpn",
    "configPath": "/usr/local/etc/xray/config.json"
  },
  "stats": {
    "totalUsers": 0,
    "totalDataTransferred": 0,
    "uptime": 100,
    "isHealthy": true,
    "lastHealthCheck": new Date()
  },
  "settings": {
    "ipv6Enabled": false,
    "metricsEnabled": true
  },
  "createdAt": new Date(),
  "updatedAt": new Date()
})

# Verify insertion
db.vpnservers.findOne({host: "114.29.236.236"})

# Expected output: shows your document with _id
```

### Option 2: Using Direct File Insert

If using a configuration file:

Create `server-config.json`:

```json
{
  "name": "V2Ray Server - SG",
  "description": "Xray/V2Ray server running API mode on HTTPS port 443",
  "host": "114.29.236.236",
  "port": 10000,
  "vpnType": "v2ray",
  "region": "ASIA",
  "country": "Singapore",
  "city": "Singapore",
  "provider": "Custom",
  "serverType": "REGULAR",
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
    "network": "tcp",
    "wsPath": "/vpn",
    "configPath": "/usr/local/etc/xray/config.json"
  },
  "stats": {
    "totalUsers": 0,
    "totalDataTransferred": 0,
    "uptime": 100,
    "isHealthy": true
  },
  "settings": {
    "ipv6Enabled": false,
    "metricsEnabled": true
  }
}
```

Then import:

```bash
mongoimport --db vpn_panel --collection vpnservers --file server-config.json
```

---

## Part 2: Panel Server Configuration Code

### Update server/controllers/serverController.js

The server controller already supports V2Ray. Verify the service factory is correctly selecting V2Ray:

```javascript
function getVpnService(server) {
  if (server.vpnType === 'outline') {
    return new OutlineService(server);
  }
  if (server.vpnType === 'v2ray') {
    return new V2rayService(server);  // ← This should be triggered
  }
  return new WireGuardService(server);
}
```

This code is already in place. **No changes needed.**

### V2rayService.js - Already Configured

The V2Ray service in `server/services/V2rayService.js` already supports API mode:

Key features:
- ✅ HTTP/HTTPS request support
- ✅ Bearer token authorization
- ✅ API base URL with port configuration
- ✅ TLS verification options
- ✅ Automatic protocol/port fallback

**No changes needed.**

---

## Part 3: Panel Environment Configuration

### Environment Variables (Optional)

If your panel uses environment variables:

```bash
# .env or similar
V2RAY_SERVER_HOST=114.29.236.236
V2RAY_SERVER_PORT=10000
V2RAY_API_BASE_URL=https://114.29.236.236:443
V2RAY_API_TOKEN=YOUR_API_TOKEN_HERE
V2RAY_TLS_VERIFY=false
```

**Note:** The V2Ray service reads these from the database server config, not from environment variables. Environment variables are optional.

---

## Part 4: Test Panel to Server Connection

### Test 1: Health Check Endpoint

```bash
# From your panel machine (or anywhere)
API_TOKEN="YOUR_API_TOKEN_HERE"

curl -k -v -X GET "https://114.29.236.236:443/health" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json"

# Expected response:
# < HTTP/1.1 200 OK
# {"status":"ok"}
```

### Test 2: API Query Endpoint

```bash
# Query existing stats
curl -k -v -X GET "https://114.29.236.236:443/" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json"

# This should contact the Xray API
```

### Test 3: From Node.js (Simulating Panel)

Create `test-v2ray-connection.js`:

```javascript
const https = require('https');

const API_TOKEN = "YOUR_API_TOKEN_HERE";
const API_URL = "https://114.29.236.236:443";

function testConnection() {
  const options = {
    hostname: "114.29.236.236",
    port: 443,
    path: "/health",
    method: "GET",
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json"
    },
    rejectUnauthorized: false  // For self-signed certs
  };

  const req = https.request(options, (res) => {
    console.log(`Status: ${res.statusCode}`);
    
    let data = "";
    res.on("data", (chunk) => { data += chunk; });
    res.on("end", () => {
      console.log("Response:", data);
    });
  });

  req.on("error", (err) => {
    console.error("Error:", err.message);
  });

  req.end();
}

testConnection();
```

Run:

```bash
node test-v2ray-connection.js

# Expected output:
# Status: 200
# Response: {"status":"ok"}
```

---

## Part 5: Create Test Device via Panel API

### API Endpoint to Add Device

Assuming your panel has an endpoint to create devices:

```bash
# Create a device on the V2Ray server
curl -X POST http://localhost:5000/api/devices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "test-device",
    "server": "XXXXX",  # Mongo ID of V2Ray server
    "plan": "XXXXX",    # Mongo ID of a plan
    "userId": "XXXXX"   # Mongo ID of a user
  }'

# Expected response:
# {
#   "success": true,
#   "device": {
#     "name": "test-device",
#     "uuid": "12345678-1234-1234-1234-123456789012",
#     "connectionConfig": {
#       "protocol": "vmess",
#       "host": "114.29.236.236",
#       "port": 10000,
#       "uuid": "12345678-1234-1234-1234-123456789012"
#     }
#   }
# }
```

### Or Via Panel UI

1. **Login to Panel** → Admin area
2. **Go to:** Servers → V2Ray Server - SG
3. **Click:** "Add Device"
4. **Fill in:**
   - Device Name: `test-device`
   - User: Select a user
   - Plan: Select a plan
5. **Click:** "Create"

Expected result:
- ✅ Device created in database
- ✅ User added to V2Ray server config
- ✅ VMess URL generated
- ✅ QR code displayed

### Monitor the Process

If device creation fails:

```bash
# Check panel logs
tail -f /path/to/panel/logs/app.log

# Check V2Ray server status
ssh root@114.29.236.236 "sudo systemctl status xray"

# Check if user was added to config
ssh root@114.29.236.236 "sudo jq '.inbounds[0].settings.clients' /usr/local/etc/xray/config.json"

# Try manual v2ray-cli test
ssh root@114.29.236.236 "v2ray-cli health"
```

---

## Part 6: Verify Device Connection

### Test 1: Verify User in V2Ray Config

SSH to server:

```bash
ssh root@114.29.236.236

# List all connected devices
sudo jq '.inbounds[0].settings.clients[] | {id:.id, email:.email}' /usr/local/etc/xray/config.json

# Expected output:
# {
#   "id": "uuid-here",
#   "email": "test-device"
# }
```

### Test 2: Connect with V2Ray Client

1. **Get VMess URL** from panel device details
2. **Copy or scan QR code**
3. **Import to V2Ray client:**
   - v2rayNG (Android)
   - Qv2ray (Windows/Linux)
   - V2rayU (macOS)
4. **Connect and test:**
   - Visit https://ip.sb to verify VPN IP
   - Should show **114.29.236.236** or Singapore IP

### Test 3: Monitor Usage in Panel

1. After client connects and generates traffic
2. **Panel → Devices → test-device**
3. **Check:** Usage (should show bytes transferred)

If showing 0 bytes:

```bash
# Check stats on server
ssh root@114.29.236.236 "xray api statsquery -pattern ''"

# Query specific device
ssh root@114.29.236.236 "v2ray-cli stats 'test-device'"
```

---

## Part 7: Complete Integration Checklist

### Server Status Checks

```bash
# SSH to V2Ray server
ssh root@114.29.236.236

# ✓ All services running?
sudo systemctl status xray nginx

# ✓ Ports listening?
sudo ss -tulpn | grep -E ':80|:443|:10000|:8080'

# ✓ Config valid?
xray -test -config /usr/local/etc/xray/config.json

# ✓ v2ray-cli working?
v2ray-cli health

# ✓ Any error logs?
sudo tail -20 /var/log/xray/error.log
sudo tail -20 /var/log/nginx/error.log
```

### Panel Status Checks

```bash
# From panel machine

# ✓ Can reach API health?
curl -k -H "Authorization: Bearer YOUR_TOKEN" https://114.29.236.236:443/health

# ✓ Server in database?
mongo vpn_panel --eval "db.vpnservers.findOne({host: '114.29.236.236'})"

# ✓ Can create device?
# Try via UI or API

# ✓ Device shows in config?
# SSH to server and check v2ray config

# ✓ Client can connect?
# Test with V2Ray client
```

---

## Part 8: Production Checklist

Before going live with this server:

### Security
- [ ] API token is strong (32+ random characters)
- [ ] API token is stored securely in panel database
- [ ] Token is updated in Nginx config (already done)
- [ ] Nginx is using HTTPS for all API traffic
- [ ] Panel uses HTTPS to reach API
- [ ] Firewall allows only necessary ports
- [ ] Non-root user running Xray (optional but recommended)

### Monitoring
- [ ] Xray service is enabled to auto-start
- [ ] Log rotation configured for Xray logs
- [ ] Panel has monitoring/alerting for server health
- [ ] SSH key authentication configured (not just password)
- [ ] Failed login attempts are monitored

### Backups
- [ ] Config file backed up: `/usr/local/etc/xray/config.json`
- [ ] Automated daily backups scheduled
- [ ] Backup testing verified

### Load Testing
- [ ] Create multiple test devices
- [ ] Generate traffic from multiple clients
- [ ] Monitor CPU, memory, bandwidth usage
- [ ] Verify stats accuracy in panel
- [ ] Check log file sizes (set up rotation if needed)

---

## Part 9: Troubleshooting Panel Integration

### Issue: Panel Can't Connect to V2Ray API

**Symptoms:**
- Device creation fails
- Error: "Failed to connect to V2Ray API"
- Status shows "Unhealthy"

**Diagnosis:**

```bash
# From panel machine
API_TOKEN="YOUR_API_TOKEN_HERE"

# Test 1: Can reach server?
ping 114.29.236.236

# Test 2: Can reach port 443?
timeout 5 bash -c "cat > /dev/null < /dev/tcp/114.29.236.236/443" && echo "OK" || echo "FAILED"

# Test 3: Can reach health endpoint?
curl -k -H "Authorization: Bearer $API_TOKEN" https://114.29.236.236:443/health -v

# Test 4: Check token is correct
# Verify token matches what's in Nginx config
ssh root@114.29.236.236 "sudo grep 'set \$api_token' /etc/nginx/sites-available/v2ray-api"
```

**Solutions:**

```bash
# Solution 1: Firewall blocking
ssh root@114.29.236.236 "sudo ufw status"
ssh root@114.29.236.236 "sudo ufw allow 443/tcp"

# Solution 2: Nginx not running
ssh root@114.29.236.236 "sudo systemctl status nginx"
ssh root@114.29.236.236 "sudo systemctl start nginx"

# Solution 3: Wrong token
# Regenerate and update both:
ssh root@114.29.236.236 "openssl rand -hex 32"
# Update Nginx and panel database with new token

# Solution 4: Certificate issue
# If using self-signed, ensure panel uses tlsVerify: false
# Check database: db.vpnservers.findOne(...).v2ray.tlsVerify
```

### Issue: Device Created But Stats Show 0

**Symptoms:**
- Device appears in panel
- Client can connect and browse
- Panel shows 0 bytes usage

**Diagnosis:**

```bash
# SSH to server
ssh root@114.29.236.236

# Check 1: Is user in config?
sudo jq '.inbounds[0].settings.clients[] | select(.email == "device-name")' /usr/local/etc/xray/config.json

# Check 2: Does config have stats enabled?
sudo jq '.stats, .policy' /usr/local/etc/xray/config.json

# Check 3: Are stats being collected?
xray api statsquery -pattern ""

# Check 4: Specific device stats
v2ray-cli stats "device-name"
```

**Solutions:**

```bash
# Solution 1: Restart Xray to enable stats
sudo systemctl restart xray
sleep 2
xray api statsquery -pattern ""

# Solution 2: Verify config has stats block
# Check in /usr/local/etc/xray/config.json:
# "stats": {},
# "policy": { "levels": { "0": { "statsUserUplink": true, "statsUserDownlink": true }}}

# Solution 3: Manually query stats
xray api statsquery -pattern "user>>>DEVICE_UUID>>>traffic"
```

### Issue: Client Can't Connect

**Symptoms:**
- VMess URL generated in panel
- Client shows "Connection failed"
- Timeout errors

**Diagnosis:**

```bash
# SSH to server
ssh root@114.29.236.236

# Check 1: VMess port listening?
sudo ss -tulpn | grep :10000

# Check 2: User in config?
sudo jq '.inbounds[0].settings.clients' /usr/local/etc/xray/config.json

# Check 3: Xray running?
sudo systemctl status xray

# Check 4: Firewall allows port?
sudo ufw status | grep 10000

# Check 5: Check error logs
sudo tail -50 /var/log/xray/error.log
```

**Solutions:**

```bash
# Solution 1: Firewall
sudo ufw allow 10000/tcp
sudo ufw reload

# Solution 2: Xray crashed
sudo systemctl restart xray
sudo journalctl -u xray -n 30

# Solution 3: Config syntax error
xray -test -config /usr/local/etc/xray/config.json

# Solution 4: Port conflict
sudo ss -tulpn | grep :10000
# If something else on 10000, change port in config and restart
```

---

## Part 10: Ongoing Maintenance

### Daily Checks

```bash
# Quick health check script
#!/bin/bash
ssh root@114.29.236.236 << 'EOF'
echo "=== Daily V2Ray Health Check ==="
echo "Date: $(date)"

# Check services
echo -n "Xray: "
systemctl is-active xray && echo "✓" || echo "✗"

echo -n "Nginx: "
systemctl is-active nginx && echo "✓" || echo "✗"

# Check API
echo -n "API Health: "
v2ray-cli health | grep -q "success" && echo "✓" || echo "✗"

# Check last errors
echo "Recent errors:"
tail -5 /var/log/xray/error.log | grep -v "^$" || echo "None"
EOF
```

### Weekly Tasks

```bash
# Check server usage
ssh root@114.29.236.236 "htop -b -n 1 | head -20"

# Check disk space
ssh root@114.29.236.236 "df -h /usr/local/etc/xray /var/log/xray"

# Backup config
scp root@114.29.236.236:/usr/local/etc/xray/config.json ./backups/config-$(date +%Y%m%d).json
```

### Monthly Tasks

```bash
# Update Xray
ssh root@114.29.236.236 "bash -c '$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)' @ install"

# Review logs for anomalies
ssh root@114.29.236.236 "wc -l /var/log/xray/*.log"

# Test backup restoration process
# Manually verify backups are correct and restorable
```

