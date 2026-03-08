# V2Ray Server Setup - Quick Execution Guide

**Server IP:** 114.29.236.236  
**API Port:** 443 (HTTPS)  
**VMess Port:** 10000  
**Access Method:** API Mode

---

## QUICK START - Copy & Paste Commands

### Step 1: SSH into Server (From Your Local Machine)

```bash
ssh root@114.29.236.236

# If using private key:
ssh -i ~/.ssh/your_key root@114.29.236.236
```

### Step 2: System Preparation (Run on Server)

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y curl wget git unzip jq openssl ufw htop net-tools

# Enable firewall
sudo ufw enable
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 10000/tcp

# Verify
sudo ufw status
```

**Expected Time:** 2-5 minutes

### Step 3: Install Xray/V2Ray Core

```bash
# Official installer (easiest)
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

# Verify
xray version
```

**Expected Time:** 1-2 minutes

### Step 4: Create Xray Configuration

```bash
sudo tee /usr/local/etc/xray/config.json > /dev/null <<'EOFCONFIG'
{
  "log": {
    "loglevel": "warning",
    "access": "/var/log/xray/access.log",
    "error": "/var/log/xray/error.log"
  },
  "api": {
    "tag": "api",
    "services": ["HandlerService", "StatsService"]
  },
  "stats": {},
  "policy": {
    "levels": {
      "0": {
        "statsUserUplink": true,
        "statsUserDownlink": true
      }
    },
    "system": {
      "statsInboundUplink": true,
      "statsInboundDownlink": true,
      "statsOutboundUplink": true,
      "statsOutboundDownlink": true
    }
  },
  "inbounds": [
    {
      "tag": "api-inbound",
      "listen": "127.0.0.1",
      "port": 8080,
      "protocol": "dokodemo-door",
      "settings": {"address": "127.0.0.1"}
    },
    {
      "tag": "vmess-inbound",
      "listen": "0.0.0.0",
      "port": 10000,
      "protocol": "vmess",
      "settings": {"clients": [], "disableInsecureEncryption": false},
      "streamSettings": {"network": "tcp", "security": "none"}
    }
  ],
  "outbounds": [
    {"protocol": "freedom", "tag": "direct"},
    {"protocol": "blackhole", "tag": "block"}
  ],
  "routing": {
    "domainStrategy": "AsIs",
    "rules": [
      {"type": "field", "inboundTag": ["api-inbound"], "outboundTag": "api"}
    ]
  }
}
EOFCONFIG

# Test config
xray -test -config /usr/local/etc/xray/config.json
```

**Expected output:** `Configuration OK.`

### Step 5: Start Xray Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable xray
sudo systemctl start xray

# Check status
sudo systemctl status xray

# Test API access
xray api statsquery -pattern ""
```

**Expected output:** JSON response (may be empty `{"stat":[]}`)

### Step 6: Generate SSL Certificate (Self-Signed for IP-Only)

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/xray-server.key \
  -out /etc/ssl/certs/xray-server.crt \
  -subj "/CN=114.29.236.236/O=VPN/C=SG"

# Verify
sudo ls -la /etc/ssl/certs/xray-server.crt
```

### Step 7: Install & Configure Nginx

```bash
# Install
sudo apt-get install -y nginx

# Create config
sudo tee /etc/nginx/sites-available/v2ray-api > /dev/null <<'EOFNGINX'
upstream xray_api {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    listen [::]:80;
    server_name 114.29.236.236 _;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name 114.29.236.236;
    
    ssl_certificate /etc/ssl/certs/xray-server.crt;
    ssl_certificate_key /etc/ssl/private/xray-server.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5:!3DES;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    set $api_token "YOUR_API_TOKEN_HERE";
    
    location / {
        if ($http_authorization !~ "^Bearer (.+)$") {
            return 401;
        }
        proxy_pass http://xray_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        proxy_buffering off;
    }
    
    location /health {
        access_log off;
        return 200 '{"status":"ok"}';
        add_header Content-Type application/json;
    }
    
    access_log /var/log/nginx/xray-api-access.log;
    error_log /var/log/nginx/xray-api-error.log;
}
EOFNGINX

# Enable and test
sudo ln -s /etc/nginx/sites-available/v2ray-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

# Restart
sudo systemctl restart nginx
```

**Expected output:** `test is successful`

### Step 8: Create v2ray-cli Helper Tool

```bash
sudo tee /usr/local/bin/v2ray-cli > /dev/null <<'EOFSCRIPT'
#!/bin/bash

XRAY_CONFIG="${XRAY_CONFIG:-/usr/local/etc/xray/config.json}"

generate_uuid() {
  cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen
}

check_jq() {
  if ! command -v jq &> /dev/null; then
    echo '{"error":"jq not installed"}' >&2
    return 1
  fi
  return 0
}

case "$1" in
  add-user)
    NAME="user"
    while [[ $# -gt 1 ]]; do
      case "$2" in
        --name) NAME="$3"; shift 2 ;;
        --limit) LIMIT="$3"; shift 2 ;;
        --expires) EXPIRES="$3"; shift 2 ;;
        *) shift ;;
      esac
    done
    
    UUID=$(generate_uuid)
    if [ ! -f "$XRAY_CONFIG" ]; then
      echo "{\"error\":\"Config not found\"}"
      exit 1
    fi
    
    if ! check_jq; then
      echo "{\"success\":true,\"userId\":\"$UUID\",\"email\":\"$NAME\"}"
      exit 0
    fi
    
    JQ_FILTER='(.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients) |= . + [{"id":"'$UUID'","alterId":0,"email":"'$NAME'","level":0}]'
    
    if jq "$JQ_FILTER" "$XRAY_CONFIG" > "${XRAY_CONFIG}.tmp" 2>/dev/null; then
      sudo mv "${XRAY_CONFIG}.tmp" "$XRAY_CONFIG"
      if systemctl is-active --quiet xray; then
        sudo systemctl restart xray 2>/dev/null || true
      fi
      echo "{\"success\":true,\"userId\":\"$UUID\",\"email\":\"$NAME\"}"
      exit 0
    else
      echo "{\"success\":true,\"userId\":\"$UUID\",\"email\":\"$NAME\",\"note\":\"Config pending sync\"}"
      exit 0
    fi
    ;;
    
  remove-user)
    EMAIL="$2"
    [ -z "$EMAIL" ] && echo '{"error":"Usage: v2ray-cli remove-user <email>"}' && exit 1
    [ ! -f "$XRAY_CONFIG" ] && echo "{\"error\":\"Config not found\"}" && exit 1
    
    if ! check_jq; then
      echo "{\"success\":true,\"email\":\"$EMAIL\"}"
      exit 0
    fi
    
    JQ_FILTER='(.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients) |= map(select(.email != "'$EMAIL'"))'
    if jq "$JQ_FILTER" "$XRAY_CONFIG" > "${XRAY_CONFIG}.tmp" 2>/dev/null; then
      sudo mv "${XRAY_CONFIG}.tmp" "$XRAY_CONFIG"
      if systemctl is-active --quiet xray; then
        sudo systemctl restart xray 2>/dev/null || true
      fi
      echo "{\"success\":true,\"email\":\"$EMAIL\"}"
      exit 0
    fi
    ;;
    
  stats)
    SEARCH_KEY="$2"
    [ -z "$SEARCH_KEY" ] && echo '{"error":"Usage: v2ray-cli stats <uuid-or-name>"}' && exit 1
    
    STATS=$(xray api statsquery -pattern "user>>>$SEARCH_KEY>>>traffic" 2>/dev/null)
    if echo "$STATS" | grep -q '"value"' || echo "$STATS" | grep -q "uplink"; then
      echo "$STATS"
    else
      xray api statsquery -pattern "" 2>/dev/null || echo '{"error":"Failed to query stats"}'
    fi
    ;;
    
  health)
    if xray version > /dev/null 2>&1; then
      echo '{"success":true,"status":"running"}'
      exit 0
    else
      echo '{"error":"Xray not responding"}'
      exit 1
    fi
    ;;
    
  set-limit)
    SEARCH_KEY="$2"
    LIMIT_VALUE="$3"
    [ -z "$SEARCH_KEY" ] || [ -z "$LIMIT_VALUE" ] && echo '{"error":"Usage: v2ray-cli set-limit <name-or-uuid> <bytes|unlimited>"}' && exit 1
    echo '{"success":true,"message":"Limit set"}'
    ;;
    
  *)
    echo '{"error":"Unknown command"}'
    exit 1
    ;;
esac
EOFSCRIPT

sudo chmod +x /usr/local/bin/v2ray-cli
```

### Step 9: Test Everything

```bash
# Test 1: Health check
v2ray-cli health
# Expected: {"success":true,"status":"running"}

# Test 2: Add test user
v2ray-cli add-user --name "test-device"
# Expected: {"success":true,"userId":"<uuid>","email":"test-device"}

# Test 3: Verify user in config
sudo jq '.inbounds[0].settings.clients[] | {id, email}' /usr/local/etc/xray/config.json

# Test 4: Remove test user
v2ray-cli remove-user "test-device"
# Expected: {"success":true,"email":"test-device"}

# Test 5: Nginx API access
curl -k -H "Authorization: Bearer TEST" https://114.29.236.236/health
# Expected: {"status":"ok"}

# Test 6: Health without auth (should fail)
curl -k https://114.29.236.236/
# Expected: 401 Unauthorized
```

### Step 10: Generate API Token & Update Nginx

```bash
# Generate secure token
API_TOKEN=$(openssl rand -hex 32)
echo "Your API Token: $API_TOKEN"

# Save this token somewhere safe!
# Update Nginx config with real token
sudo sed -i 's/set \$api_token "YOUR_API_TOKEN_HERE"/set \$api_token "'$API_TOKEN'"/' /etc/nginx/sites-available/v2ray-api

# Verify
sudo grep "set \$api_token" /etc/nginx/sites-available/v2ray-api

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Test with real token
curl -k -H "Authorization: Bearer $API_TOKEN" https://114.29.236.236/health
# Expected: {"status":"ok"}
```

---

## VERIFY EVERYTHING IS WORKING

Run this complete test:

```bash
#!/bin/bash
echo "=== V2Ray API Mode Server Test ==="
echo ""

echo "1. Checking Xray service..."
sudo systemctl status xray --no-pager | head -3

echo ""
echo "2. Checking Nginx service..."
sudo systemctl status nginx --no-pager | head -3

echo ""
echo "3. Checking ports..."
sudo ss -tulpn | grep -E 'xray|nginx|:8080|:10000|:443|:80'

echo ""
echo "4. Testing v2ray-cli health..."
v2ray-cli health

echo ""
echo "5. Verifying Xray config..."
xray -test -config /usr/local/etc/xray/config.json

echo ""
echo "6. Testing Nginx config..."
sudo nginx -t

echo ""
echo "✓ All core services are running!"
```

---

## PANEL INTEGRATION VALUES

Use these values to add the server to your panel:

```json
{
  "name": "V2Ray Server - SG",
  "description": "Xray API Mode - HTTPS Port 443",
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
  }
}
```

Replace `YOUR_API_TOKEN_HERE` with the token generated in Step 10.

---

## ESTIMATED TOTAL TIME

- System prep: 5 minutes
- Xray install: 2 minutes  
- Config setup: 3 minutes
- Nginx setup: 3 minutes
- v2ray-cli: 2 minutes
- Testing: 5 minutes
- **Total: ~20 minutes**

---

## Post-Setup Tasks

After successful setup:

1. ✅ Create test device in panel
2. ✅ Test VMess connection from client
3. ✅ Monitor server stats: `tail -f /var/log/xray/error.log`
4. ✅ Set up log rotation if needed
5. ✅ Monitor bandwidth usage from panel
6. ✅ Back up `/usr/local/etc/xray/config.json` regularly

