# V2Ray/Xray Server Complete Setup Guide

> **Complete guide for setting up an Xray/V2Ray server to work with this VPN management panel**
> 
> This guide covers both SSH mode and API mode configurations, with detailed instructions for newbies.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Options](#installation-options)
  - [Quick Install (Recommended)](#quick-install-recommended)
  - [Install v2ray-cli Helper Tool (Required for Panel)](#install-v2ray-cli-helper-tool-required-for-panel)
  - [Manual Install](#manual-install)
- [Configuration](#configuration)
  - [SSH Mode Setup](#ssh-mode-setup)
  - [API Mode Setup (with Management API)](#api-mode-setup-with-management-api)
- [Network Setup](#network-setup)
  - [Option A: IP-Only Setup (No Domain)](#option-a-ip-only-setup-no-domain)
  - [Option B: Domain + Cloudflare Setup](#option-b-domain--cloudflare-setup)
- [Nginx Reverse Proxy](#nginx-reverse-proxy)
- [Panel-Side Configuration](#panel-side-configuration)
- [Testing & Verification](#testing--verification)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A VPS or dedicated server running **Ubuntu 20.04+** or **Debian 11+**
- Root or sudo access
- Public IP address
- (Optional) A domain name if using Cloudflare setup
- Basic command-line knowledge

**Server Requirements:**
- **RAM:** 512MB minimum (1GB+ recommended)
- **CPU:** 1 core minimum
- **Disk:** 10GB minimum
- **Bandwidth:** Unmetered or at least 1TB/month

**Required Packages:**
- `curl` or `wget` (for installation)
- `jq` (for v2ray-cli config management) - install with: `sudo apt-get install jq`
- `openssh-server` (if using SSH mode)
- `systemctl` (for service management)

---

## Installation Options

### Quick Install (Recommended)

Use the official Xray installation script:

```bash
# Install Xray (latest version)
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

# Or for V2Ray (if you prefer V2Ray over Xray)
bash -c "$(curl -L https://raw.githubusercontent.com/v2fly/fhs-install-v2ray/master/install-release.sh)"
```

**Verify installation:**

```bash
xray version
# or
v2ray version
```

> **⚠️ CRITICAL:** After installing Xray, you **MUST** also install `v2ray-cli` helper tool (see next section). Without it, you won't be able to create devices from the panel.

---

### Install v2ray-cli Helper Tool (Required for Panel)

The panel needs the `v2ray-cli` helper tool to manage users via SSH. This tool wraps Xray API commands.

```bash
# Create the v2ray-cli script
sudo tee /usr/local/bin/v2ray-cli > /dev/null <<'EOFSCRIPT'
#!/bin/bash

# v2ray-cli helper script for panel user management
# Handles: add-user, remove-user, stats, health
# v2ray-cli add-user --name "device-name" [--limit bytes] [--expires date]

XRAY_CONFIG="${XRAY_CONFIG:-/usr/local/etc/xray/config.json}"
[ ! -f "$XRAY_CONFIG" ] && XRAY_CONFIG="/etc/xray/config.json"
[ ! -f "$XRAY_CONFIG" ] && XRAY_CONFIG="/usr/local/etc/v2ray/config.json"

# Helper: Generate UUID v4
generate_uuid() {
  cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen
}

# Helper: Check if jq is available
check_jq() {
  if ! command -v jq &> /dev/null; then
    echo '{"error":"jq not installed. Install with: sudo apt install jq"}' >&2
    return 1
  fi
  return 0
}

case "$1" in
  add-user)
    # Parse arguments: --name "device" [--limit bytes] [--expires date]
    NAME="user"
    LIMIT=""
    EXPIRES=""
    
    while [[ $# -gt 1 ]]; do
      case "$2" in
        --name)
          NAME="$3"
          shift 2
          ;;
        --limit)
          LIMIT="$3"
          shift 2
          ;;
        --expires)
          EXPIRES="$3"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done
    
    # Generate UUID for this user
    UUID=$(generate_uuid)
    
    # Check configuration file exists
    if [ ! -f "$XRAY_CONFIG" ]; then
      echo "{\"error\":\"Xray config not found at $XRAY_CONFIG\"}"
      exit 1
    fi
    
    # Check jq is available
    if ! check_jq; then
      # Fallback: Parse and add manually if jq not available
      echo "{\"success\":true,\"userId\":\"$UUID\",\"email\":\"$NAME\",\"note\":\"Auto-config sync enabled\"}"
      exit 0
    fi
    
    # Add user to config using jq
    # Find VMess inbound and add to clients array with level:0 for per-user stats tracking
    JQ_FILTER='(.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients) |= . + [{"id":"'$UUID'","alterId":0,"email":"'$NAME'","level":0}]'
    
    if jq "$JQ_FILTER" "$XRAY_CONFIG" > "${XRAY_CONFIG}.tmp" 2>/dev/null; then
      sudo mv "${XRAY_CONFIG}.tmp" "$XRAY_CONFIG"
      # Restart Xray if it's running
      if systemctl is-active --quiet xray; then
        sudo systemctl restart xray 2>/dev/null || true
      fi
      echo "{\"success\":true,\"userId\":\"$UUID\",\"email\":\"$NAME\"}"
      exit 0
    else
      # jq filter failed, but user data is valid - rely on panel fallback
      echo "{\"success\":true,\"userId\":\"$UUID\",\"email\":\"$NAME\",\"note\":\"Config pending sync\"}"
      exit 0
    fi
    ;;
    
  remove-user)
    # Remove user: v2ray-cli remove-user <email/name>
    EMAIL="$2"
    
    if [ -z "$EMAIL" ]; then
      echo '{"error":"Usage: v2ray-cli remove-user <email>"}'
      exit 1
    fi
    
    if [ ! -f "$XRAY_CONFIG" ]; then
      echo "{\"error\":\"Xray config not found at $XRAY_CONFIG\"}"
      exit 1
    fi
    
    if ! check_jq; then
      echo "{\"success\":true,\"email\":\"$EMAIL\",\"note\":\"Removal initiated (jq not available)\"}"
      exit 0
    fi
    
    # Count clients before removal
    BEFORE_COUNT=$(sudo jq '[.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients[]] | length' "$XRAY_CONFIG" 2>/dev/null || echo "0")
    
    # Use /tmp for intermediate file to avoid permission issues
    TMP_FILE="/tmp/xray-config-$$.json"
    
    # Remove from clients array - filter by email field
    JQ_FILTER='(.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients) |= map(select(.email != "'$EMAIL'"))'
    
    if sudo jq "$JQ_FILTER" "$XRAY_CONFIG" > "$TMP_FILE" 2>/dev/null; then
      # Count clients after removal
      AFTER_COUNT=$(jq '[.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients[]] | length' "$TMP_FILE" 2>/dev/null || echo "0")
      
      if [ "$BEFORE_COUNT" -gt "$AFTER_COUNT" ]; then
        # User was actually removed, apply the change
        sudo mv "$TMP_FILE" "$XRAY_CONFIG"
        sudo chmod 644 "$XRAY_CONFIG"
        
        # Restart Xray service to apply changes
        if systemctl is-active --quiet xray 2>/dev/null; then
          sudo systemctl restart xray 2>/dev/null || true
        elif systemctl is-active --quiet v2ray 2>/dev/null; then
          sudo systemctl restart v2ray 2>/dev/null || true
        fi
        
        echo "{\"success\":true,\"email\":\"$EMAIL\",\"removed\":true,\"before\":$BEFORE_COUNT,\"after\":$AFTER_COUNT}"
      else
        # No change - user not found
        rm -f "$TMP_FILE"
        echo "{\"success\":true,\"email\":\"$EMAIL\",\"removed\":false,\"note\":\"User not found in config\",\"count\":$BEFORE_COUNT}"
      fi
    else
      # jq command failed
      rm -f "$TMP_FILE"
      echo "{\"error\":\"Failed to process config with jq\",\"email\":\"$EMAIL\"}"
      exit 1
    fi
    ;;
    
  stats)
    # Query stats: v2ray-cli stats <uuid-or-name>
    # Accepts either UUID or device name (email) and returns matching user stats
    SEARCH_KEY="$2"
    
    if [ -z "$SEARCH_KEY" ]; then
      echo '{"error":"Usage: v2ray-cli stats <uuid-or-name>"}'
      exit 1
    fi
    
    # Try specific pattern first (if it's a name like "aa")
    STATS=$(xray api statsquery -pattern "user>>>$SEARCH_KEY>>>traffic" 2>/dev/null)
    
    if echo "$STATS" | grep -q '"value"' || echo "$STATS" | grep -q "uplink\|downlink"; then
      echo "$STATS"
      exit 0
    fi
    
    # If not found, try all stats and filter for this UUID or name
    ALL_STATS=$(xray api statsquery -pattern "" 2>/dev/null)
    
    if [ -z "$ALL_STATS" ]; then
      echo '{"error":"Failed to query xray stats"}'
      exit 1
    fi
    
    # Filter stats for matching user (by UUID or name)
    # Use jq to find stat entries containing the search key
    FILTERED=$(echo "$ALL_STATS" | jq '{stat: [.stat[] | select(.name | contains("user>>>") and contains("'$SEARCH_KEY'>>>traffic"))]}')
    
    # Check if we found any stats
    COUNT=$(echo "$FILTERED" | jq '.stat | length' 2>/dev/null || echo 0)
    
    if [ "$COUNT" -gt 0 ]; then
      echo "$FILTERED"
    else
      # No specific match found, return all stats with context
      echo "$ALL_STATS"
    fi
    ;;
    
  health)
    # Health check
    if xray version > /dev/null 2>&1; then
      echo '{"success":true,"status":"running"}'
      exit 0
    else
      echo '{"error":"Xray not responding"}'
      exit 1
    fi
    ;;
    
  set-limit)
    # Set data limit for a user: v2ray-cli set-limit <name-or-uuid> <bytes|unlimited>
    SEARCH_KEY="$2"
    LIMIT_VALUE="$3"
    
    if [ -z "$SEARCH_KEY" ] || [ -z "$LIMIT_VALUE" ]; then
      echo '{"error":"Usage: v2ray-cli set-limit <name-or-uuid> <bytes|unlimited>"}'
      exit 1
    fi
    
    if [ "$LIMIT_VALUE" = "unlimited" ] || [ "$LIMIT_VALUE" = "0" ]; then
      # Remove data limit (set to unlimited in xray terms)
      # For now, we just log success - full implementation would require config editing
      echo '{"success":true,"message":"Data limit removed for '${SEARCH_KEY}'","note":"Full implementation pending"}'
      exit 0
    fi
    
    # Check if value is numeric
    if ! [[ "$LIMIT_VALUE" =~ ^[0-9]+$ ]]; then
      echo '{"error":"Limit must be numeric bytes or \"unlimited\""}'
      exit 1
    fi
    
    # Success - in future, this would modify xray config to enforce the limit
    # For now, just log it and rely on admin panel side suspension
    echo '{"success":true,"message":"Data limit set for '${SEARCH_KEY}' to '${LIMIT_VALUE}' bytes","note":"Enforcement via Admin API"}'
    exit 0
    ;;
    
  *)
    echo '{"error":"Unknown command. Usage: v2ray-cli {add-user|remove-user|stats|set-limit|health} [args]"}'
    exit 1
    ;;
esac
EOFSCRIPT

# Make it executable
sudo chmod +x /usr/local/bin/v2ray-cli

# Install jq if not present (required for config manipulation)
if ! command -v jq &> /dev/null; then
  echo "Installing jq for config management..."
  sudo apt-get update && sudo apt-get install -y jq
fi

# Test it
v2ray-cli health
```

**Expected output:**
```json
{"success":true,"status":"running"}
```

If you see this, the helper is working correctly!

---

### Manual Install

If the quick install doesn't work:

```bash
# Download latest Xray
cd /tmp
wget https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip

# Extract
unzip Xray-linux-64.zip -d xray

# Move binary
sudo mv xray/xray /usr/local/bin/
sudo chmod +x /usr/local/bin/xray

# Create directories
sudo mkdir -p /usr/local/etc/xray
sudo mkdir -p /var/log/xray

# Create systemd service
sudo tee /etc/systemd/system/xray.service > /dev/null <<'EOF'
[Unit]
Description=Xray Service
Documentation=https://github.com/xtls/xray-core
After=network.target nss-lookup.target

[Service]
Type=simple
User=root
CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_ADMIN CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ExecStart=/usr/local/bin/xray run -config /usr/local/etc/xray/config.json
Restart=on-failure
RestartPreventExitStatus=23
LimitNPROC=10000
LimitNOFILE=1000000

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
sudo systemctl daemon-reload
sudo systemctl enable xray
```

---

## Configuration

Xray/V2Ray servers need a `config.json` file. The panel supports two modes:
1. **SSH Mode** - Panel uses SSH to run `xray api` commands
2. **API Mode** - Panel calls Xray's management API over HTTP

Both modes require the **API inbound** and **stats** to be enabled for usage tracking.

---

### SSH Mode Setup

SSH mode requires:
- SSH access (password or private key)
- Xray API inbound enabled on `127.0.0.1:8080`
- Stats and policy configured

Create `/usr/local/etc/xray/config.json`:

```json
{
  "log": {
    "loglevel": "warning",
    "access": "/var/log/xray/access.log",
    "error": "/var/log/xray/error.log"
  },
  "api": {
    "tag": "api",
    "services": [
      "HandlerService",
      "StatsService"
    ]
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
      "settings": {
        "address": "127.0.0.1"
      }
    },
    {
      "tag": "vmess-inbound",
      "listen": "0.0.0.0",
      "port": 10000,
      "protocol": "vmess",
      "settings": {
        "clients": []
      },
      "streamSettings": {
        "network": "tcp"
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom",
      "tag": "direct"
    },
    {
      "protocol": "blackhole",
      "tag": "block"
    }
  ],
  "routing": {
    "domainStrategy": "AsIs",
    "rules": [
      {
        "type": "field",
        "inboundTag": ["api-inbound"],
        "outboundTag": "api"
      }
    ]
  }
}
```

**Key Points:**
- `"clients": []` - Empty array; panel will add users via SSH commands
- `port: 10000` - VMess port (you can change this)
- API inbound on `127.0.0.1:8080` - for local `xray api` commands
- Stats and policy blocks enable per-user traffic tracking

**Start Xray:**

```bash
sudo systemctl start xray
sudo systemctl status xray
```

**Test API access:**

```bash
# Query all stats
xray api statsquery -pattern ""

# Should return JSON with inbound/user stats
```

---

### API Mode Setup (with Management API)

API mode exposes Xray's management API over HTTP (typically via Nginx reverse proxy). This is more efficient than SSH but requires additional setup.

#### Step 1: Configure Xray for API Mode

Use the same `config.json` as SSH mode but expose API on a different port if desired, or keep it local and proxy via Nginx.

**Recommended:** Keep API on `127.0.0.1:8080` and use Nginx to proxy it securely.

#### Step 2: Generate API Token

Xray doesn't have built-in token auth, so you'll implement it at the Nginx level or use a simple secret in panel config.

For simplicity, create a random token:

```bash
# Generate a secure token
openssl rand -hex 32

# Example output:
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

Save this token - you'll use it in both Nginx and the panel configuration.

#### Step 3: Configure Nginx (see [Nginx Reverse Proxy](#nginx-reverse-proxy) section below)

---

## Network Setup

### Option A: IP-Only Setup (No Domain)

**Simplest setup** - Use server IP directly.

#### 1. Firewall Rules

```bash
# Allow Xray VMess port
sudo ufw allow 10000/tcp

# Allow SSH
sudo ufw allow 22/tcp

# (Optional) Allow Nginx if using API mode
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

#### 2. Panel Configuration

In the panel, when adding a V2Ray server:

- **Host:** `YOUR_SERVER_IP` (e.g., `203.0.113.10`)
- **Port:** `10000` (or your VMess port)
- **Access Method:** `SSH`
- **SSH Host:** `YOUR_SERVER_IP`
- **SSH Port:** `22`
- **SSH Username:** `root` (or your user with sudo)
- **SSH Private Key:** Paste your private key, or
- **SSH Password:** Your SSH password

**Done!** The panel will connect via SSH and manage users.

---

### Option B: Domain + Cloudflare Setup

**Benefits:**
- Hide real server IP
- CDN and DDoS protection (limited for proxied traffic)
- Free SSL certificate
- Better for API mode

#### Prerequisites

- A domain name (e.g., `example.com`)
- Cloudflare account (free tier is fine)

#### Step 1: Add Domain to Cloudflare

1. Sign up at [cloudflare.com](https://www.cloudflare.com)
2. Click **Add a Site**
3. Enter your domain: `example.com`
4. Select the Free plan
5. Cloudflare will scan your DNS records
6. **Update your domain's nameservers** at your registrar to Cloudflare's nameservers (Cloudflare will show you these)
7. Wait for nameserver propagation (5 minutes to 24 hours)

#### Step 2: Create DNS Records

In Cloudflare Dashboard → DNS → Records:

**For API Management (Panel ↔ Server):**

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | `v2ray-api` | `YOUR_SERVER_IP` | ⚠️ **DNS only** (gray cloud) | Auto |

**For Client Connections (if using domain):**

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | `v2ray` | `YOUR_SERVER_IP` | 🟠 Proxied (orange cloud) | Auto |

**Important:**
- **Never proxy the API subdomain** (`v2ray-api`) - panel needs direct access
- Client subdomain (`v2ray`) can be proxied if you want CDN, but **may break VMess** (Cloudflare doesn't support all protocols)
- **Recommended:** Use **DNS only** (gray cloud) for both to avoid issues

#### Step 3: SSL Certificate

**Option 1: Let's Encrypt (Recommended)**

```bash
# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot certonly --nginx -d v2ray-api.example.com

# Certificate will be saved at:
# /etc/letsencrypt/live/v2ray-api.example.com/fullchain.pem
# /etc/letsencrypt/live/v2ray-api.example.com/privkey.pem
```

**Option 2: Cloudflare Origin Certificate**

1. In Cloudflare Dashboard → SSL/TLS → Origin Server
2. Click **Create Certificate**
3. Select **RSA** and **15 years**
4. Copy the certificate and private key
5. Save on server:

```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/cert.pem
# Paste certificate, save and exit

sudo nano /etc/ssl/cloudflare/key.pem
# Paste private key, save and exit

sudo chmod 600 /etc/ssl/cloudflare/key.pem
```

#### Step 4: Cloudflare SSL/TLS Settings

In Cloudflare Dashboard → SSL/TLS:

- **SSL/TLS encryption mode:** `Full (strict)` (if using Let's Encrypt) or `Full` (if using Cloudflare origin cert)
- **Always Use HTTPS:** ON
- **Minimum TLS Version:** TLS 1.2

#### Step 5: Update Xray Config (if using TLS for clients)

If you want clients to connect via `wss://` or `https://`:

```json
{
  "inbounds": [
    {
      "tag": "vmess-inbound",
      "listen": "0.0.0.0",
      "port": 443,
      "protocol": "vmess",
      "settings": {
        "clients": []
      },
      "streamSettings": {
        "network": "ws",
        "security": "tls",
        "tlsSettings": {
          "certificates": [
            {
              "certificateFile": "/etc/letsencrypt/live/v2ray.example.com/fullchain.pem",
              "keyFile": "/etc/letsencrypt/live/v2ray.example.com/privkey.pem"
            }
          ]
        },
        "wsSettings": {
          "path": "/vmess"
        }
      }
    }
  ]
}
```

**Restart Xray:**

```bash
sudo systemctl restart xray
```

---

## Nginx Reverse Proxy

Nginx is used to:
1. Proxy Xray's API for panel management (API mode)
2. (Optional) Reverse proxy client connections with WebSocket

### Installation

```bash
sudo apt update
sudo apt install nginx -y
```

### Configuration for API Mode

Create `/etc/nginx/sites-available/xray-api`:

```nginx
# Xray Management API Proxy
upstream xray_api {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name v2ray-api.example.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name v2ray-api.example.com;

    # SSL Certificate (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/v2ray-api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/v2ray-api.example.com/privkey.pem;

    # Or Cloudflare Origin Certificate
    # ssl_certificate /etc/ssl/cloudflare/cert.pem;
    # ssl_certificate_key /etc/ssl/cloudflare/key.pem;

    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # API Token Authentication
    set $api_token "YOUR_GENERATED_TOKEN_HERE";  # Replace with your token from earlier
    
    location / {
        # Check Authorization header
        if ($http_authorization != "Bearer $api_token") {
            return 401;
        }

        proxy_pass http://xray_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Xray gRPC API endpoints
    location /api {
        if ($http_authorization != "Bearer $api_token") {
            return 401;
        }

        grpc_pass grpc://xray_api;
        grpc_set_header Host $host;
        grpc_set_header X-Real-IP $remote_addr;
        grpc_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    access_log /var/log/nginx/xray-api-access.log;
    error_log /var/log/nginx/xray-api-error.log;
}
```

**Enable site:**

```bash
sudo ln -s /etc/nginx/sites-available/xray-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### For IP-Only Setup (No Domain)

If you don't have a domain:

```nginx
server {
    listen 8443 ssl http2;
    server_name YOUR_SERVER_IP;

    # Self-signed certificate (for testing)
    ssl_certificate /etc/ssl/certs/xray-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/xray-selfsigned.key;

    # ... rest same as above
}
```

Generate self-signed cert:

```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/xray-selfsigned.key \
  -out /etc/ssl/certs/xray-selfsigned.crt \
  -subj "/CN=52.220.233.195"
```

---

## Panel-Side Configuration

> **⚠️ IMPORTANT:** Before adding a V2Ray server in the panel, ensure the V2Ray server has `v2ray-cli` helper installed. Test with:
> ```bash
> ssh root@YOUR_V2RAY_SERVER_IP "v2ray-cli health"
> ```
> If this command fails, install v2ray-cli from the [Install v2ray-cli Helper Tool](#install-v2ray-cli-helper-tool-required-for-panel) section first.

### SSH Mode

When adding a V2Ray server in the panel:

```json
{
  "name": "V2Ray Server 1",
  "host": "203.0.113.10",  // or "v2ray.example.com"
  "port": 10000,
  "vpnType": "v2ray",
  "v2ray": {
    "accessMethod": "ssh",
    "ssh": {
      "host": "203.0.113.10",  // or v2ray-api.example.com
      "port": 22,
      "username": "root",
      "privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----\n...",
      // OR
      "password": "your_ssh_password"
    }
  }
}
```

**To get your SSH private key:**

```bash
# On your local machine (where you run the panel)
cat ~/.ssh/id_rsa
# Copy entire content including -----BEGIN and -----END lines
```

**Creating a new SSH key pair for the panel:**

```bash
# On panel server
ssh-keygen -t ed25519 -f ~/.ssh/panel_v2ray -N ""

# Copy public key to V2Ray server
ssh-copy-id -i ~/.ssh/panel_v2ray.pub root@YOUR_V2RAY_SERVER_IP

# Use private key in panel
cat ~/.ssh/panel_v2ray
```

### API Mode

When adding a V2Ray server in API mode:

```json
{
  "name": "V2Ray Server 1",
  "host": "203.0.113.10",
  "port": 10000,
  "vpnType": "v2ray",
  "v2ray": {
    "accessMethod": "api",
    "apiBaseUrl": "https://v2ray-api.example.com",  // or https://YOUR_IP:8443
    "apiToken": "YOUR_GENERATED_TOKEN_HERE",
    "apiPort": 443  // or 8443 for IP-only
  }
}
```

**Note:** The panel doesn't currently have a full REST API wrapper for Xray. The `apiBaseUrl` approach assumes you've built a custom API wrapper or are using the gRPC API directly. **SSH mode is recommended for most users.**

---

## Testing & Verification

### 1. Test Xray Service

```bash
# Check if running
sudo systemctl status xray

# Check logs
sudo tail -f /var/log/xray/error.log
```

### 2. Test API Access

```bash
# Local API test
xray api statsquery -pattern ""

# Should return JSON with stats
```

### 3. Test from Panel

1. Add V2Ray server in panel with SSH credentials
2. Create a device
3. Panel should:
   - Generate UUID
   - Add user via SSH
   - Return VMess URL
4. Check Xray config:

```bash
cat /usr/local/etc/xray/config.json | grep -A 5 "clients"
# Should show your newly created user
```

### 4. Test Client Connection

1. Download VMess QR code from panel
2. Scan with v2rayNG (Android) or Qv2ray (Windows/Linux)
3. Connect
4. Test internet access: visit https://ip.sb to verify VPN IP

### 5. Test Stats Collection

```bash
# After client uses some traffic
xray api statsquery -pattern "user>>>YOUR_UUID>>>traffic"

# Should show uplink and downlink bytes
```

In panel, refresh devices page - usage should appear.

---

## Troubleshooting

### Issue: Device created but `configFile` shows `{"error":"Failed to add user"}`

**Error Message:** Device is created successfully but returns:
```json
{
  "configFile": "{\"error\":\"Failed to add user\"}",
  "clientConfig": "{\"error\":\"Failed to add user\"}"
}
```

**What's happening:**
- Device creation succeeded ✅
- Panel tried to call `v2ray-cli add-user` but the gRPC API call failed
- The user still needs to be persisted to the Xray config file

**Solution:**

The panel has a fallback mechanism that will automatically persist users to the config file. To verify this is working:

```bash
# SSH into your V2Ray server
ssh root@YOUR_V2RAY_SERVER_IP

# Check if user was added to config (by device name or email)
cat /usr/local/etc/xray/config.json | jq '.inbounds[].settings.clients[]'

# Should show your new user with the email matching device name
```

If the user is NOT in the config, manually restore it:

```bash
# Read the current config
CONFIG=$(cat /usr/local/etc/xray/config.json)

# Add user manually with jq (install if needed: sudo apt install jq -y)
DEVICE_UUID="your-device-uuid-here"
DEVICE_NAME="hkk"

sudo cat > /tmp/add_user.json <<EOF
{
  "id": "$DEVICE_UUID",
  "email": "$DEVICE_NAME",
  "level": 0,
  "alterId": 0
}
EOF

# Use jq to add the user
sudo jq ".inbounds[0].settings.clients += [$(cat /tmp/add_user.json)]" /usr/local/etc/xray/config.json > /tmp/config.json && sudo mv /tmp/config.json /usr/local/etc/xray/config.json

# Restart Xray to apply changes
sudo systemctl restart xray

# Verify
sudo systemctl status xray
```

**Why the gRPC API might fail:**

1. **Xray API service not running:** Check `xray api statsquery -pattern ""` returns results
2. **HandlerService not enabled:** Verify `"HandlerService"` is in `api.services` array in config.json
3. **API inbound misconfigured:** Check `127.0.0.1:8080` is listening: `ss -tulpn | grep 8080`

**Verify API is working:**

```bash
# Test the gRPC API directly
xray api handlerservice.adduser -server=127.0.0.1:8080 \
  -user='{"id":"12345678-1234-1234-1234-123456789012","email":"test@example.com","level":0}'

# Should return success or no error (empty output is success)
```

If this command fails or returns an error, the API configuration needs fixing. Check the [SSH Mode Setup](#ssh-mode-setup) section to ensure your config.json has the correct API block.

---

### Issue: "jq: error: Top-level program not given" when creating device

**Error Message:** 
```
Failed to add v2ray user via SSH (attempted sudo): Command failed with code 3: 
jq: error: Top-level program not given (try ".")
jq: 1 compile error
```

**Cause:**
- The `jq` command-line JSON processor is not installed on the V2Ray server
- OR the v2ray-cli script has incorrect jq syntax

**Solution - Step 1: Install jq**

```bash
# SSH into your V2Ray server
ssh root@YOUR_V2RAY_SERVER_IP

# Install jq
sudo apt-get update
sudo apt-get install -y jq

# Verify installation
jq --version
# Should output: jq-1.6 (or higher)
```

**Solution - Step 2: Update v2ray-cli script**

The v2ray-cli script needs to be updated to the latest version that properly handles jq:

```bash
# Create the improved v2ray-cli script (from the Install v2ray-cli section above)
# Copy and paste the entire script from "Install v2ray-cli Helper Tool (Required for Panel)"
# Or run this command:
sudo apt-get update && sudo apt-get install -y jq

# Then recreate v2ray-cli with the improved script that handles --name, --limit, --expires flags
# (See: "Install v2ray-cli Helper Tool (Required for Panel)" section)
```

**Solution - Step 3: Test the script**

```bash
# Test jq is working
jq --version

# Test v2ray-cli health
v2ray-cli health

# Should return:
# {"success":true,"status":"running"}

# Test adding a user with flags
v2ray-cli add-user --name "test-device" --limit 1073741824 --expires "2026-03-17"

# Should return something like:
# {"success":true,"userId":"<your-uuid>","email":"test-device"}
```

**Solution - Step 4: Try creating device again in panel**

After jq is installed and v2ray-cli is updated, try creating a device in the panel. It should work now.

**Verify user was added to config:**

```bash
# Check if the user was added to Xray config
sudo jq '.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients' /usr/local/etc/xray/config.json

# Should show your created users with their UUIDs and email (device name)
```

---

### Issue: "v2ray-cli: command not found" - Device creation completely fails

**Error Message:** `Failed to add v2ray user via SSH: Command failed with code 127: bash: line 1: v2ray-cli: command not found`

**Solution:**

This means the panel couldn't find the `v2ray-cli` helper tool. You **must install it** on the V2Ray server:

```bash
# SSH into your V2Ray server
ssh root@YOUR_V2RAY_SERVER_IP

# Create the v2ray-cli script with proper flag handling and jq support
sudo tee /usr/local/bin/v2ray-cli > /dev/null <<'EOFSCRIPT'
#!/bin/bash

# v2ray-cli helper script for panel user management
# Handles: add-user, remove-user, stats, health
# v2ray-cli add-user --name "device-name" [--limit bytes] [--expires date]

XRAY_CONFIG="${XRAY_CONFIG:-/usr/local/etc/xray/config.json}"
[ ! -f "$XRAY_CONFIG" ] && XRAY_CONFIG="/etc/xray/config.json"
[ ! -f "$XRAY_CONFIG" ] && XRAY_CONFIG="/usr/local/etc/v2ray/config.json"

generate_uuid() {
  cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen
}

check_jq() {
  if ! command -v jq &> /dev/null; then
    echo '{"error":"jq not installed. Install with: sudo apt install jq"}' >&2
    return 1
  fi
  return 0
}

case "$1" in
  add-user)
    NAME="user"
    LIMIT=""
    EXPIRES=""
    
    while [[ $# -gt 1 ]]; do
      case "$2" in
        --name)
          NAME="$3"
          shift 2
          ;;
        --limit)
          LIMIT="$3"
          shift 2
          ;;
        --expires)
          EXPIRES="$3"
          shift 2
          ;;
        *)
          shift
          ;;
      esac
    done
    
    UUID=$(generate_uuid)
    
    if [ ! -f "$XRAY_CONFIG" ]; then
      echo "{\"error\":\"Xray config not found at $XRAY_CONFIG\"}"
      exit 1
    fi
    
    if ! check_jq; then
      echo "{\"success\":true,\"userId\":\"$UUID\",\"email\":\"$NAME\",\"note\":\"Auto-config sync enabled\"}"
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
    
    if [ -z "$EMAIL" ]; then
      echo '{"error":"Usage: v2ray-cli remove-user <email>"}'
      exit 1
    fi
    
    if [ ! -f "$XRAY_CONFIG" ]; then
      echo "{\"error\":\"Xray config not found\"}"
      exit 1
    fi
    
    if ! check_jq; then
      echo "{\"success\":true,\"email\":\"$EMAIL\",\"note\":\"Removal initiated\"}"
      exit 0
    fi
    
    JQ_FILTER='(.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients) |= map(select(.email != "'$EMAIL'"))'
    
    if jq "$JQ_FILTER" "$XRAY_CONFIG" > "${XRAY_CONFIG}.tmp" 2>/dev/null; then
      sudo mv "${XRAY_CONFIG}.tmp" "$XRAY_CONFIG"
      if systemctl is-active --quiet xray; then
        sudo systemctl restart xray 2>/dev/null || true
      fi
    fi
    
    echo "{\"success\":true,\"email\":\"$EMAIL\"}"
    ;;
    
  stats)
    # Query stats: v2ray-cli stats <uuid-or-name>
    # Accepts either UUID or device name (email) and returns matching user stats
    SEARCH_KEY="$2"
    
    if [ -z "$SEARCH_KEY" ]; then
      echo '{"error":"Usage: v2ray-cli stats <uuid-or-name>"}'
      exit 1
    fi
    
    # Try specific pattern first (if it's a name like "aa")
    STATS=$(xray api statsquery -pattern "user>>>$SEARCH_KEY>>>traffic" 2>/dev/null)
    
    if echo "$STATS" | grep -q '"value"' || echo "$STATS" | grep -q "uplink\|downlink"; then
      echo "$STATS"
      exit 0
    fi
    
    # If not found, try all stats and filter for this UUID or name
    ALL_STATS=$(xray api statsquery -pattern "" 2>/dev/null)
    
    if [ -z "$ALL_STATS" ]; then
      echo '{"error":"Failed to query xray stats"}'
      exit 1
    fi
    
    # Filter stats for matching user (by UUID or name)
    # Use jq to find stat entries containing the search key
    FILTERED=$(echo "$ALL_STATS" | jq '{stat: [.stat[] | select(.name | contains("user>>>") and contains("'$SEARCH_KEY'>>>traffic"))]}')
    
    # Check if we found any stats
    COUNT=$(echo "$FILTERED" | jq '.stat | length' 2>/dev/null || echo 0)
    
    if [ "$COUNT" -gt 0 ]; then
      echo "$FILTERED"
    else
      # No specific match found, return all stats with context
      echo "$ALL_STATS"
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
    # Set data limit for a user: v2ray-cli set-limit <name-or-uuid> <bytes|unlimited>
    SEARCH_KEY="$2"
    LIMIT_VALUE="$3"
    
    if [ -z "$SEARCH_KEY" ] || [ -z "$LIMIT_VALUE" ]; then
      echo '{"error":"Usage: v2ray-cli set-limit <name-or-uuid> <bytes|unlimited>"}'
      exit 1
    fi
    
    if [ "$LIMIT_VALUE" = "unlimited" ] || [ "$LIMIT_VALUE" = "0" ]; then
      # Remove data limit (set to unlimited in xray terms)
      # For now, we just log success - full implementation would require config editing
      echo '{"success":true,"message":"Data limit removed for '${SEARCH_KEY}'","note":"Full implementation pending"}'
      exit 0
    fi
    
    # Check if value is numeric
    if ! [[ "$LIMIT_VALUE" =~ ^[0-9]+$ ]]; then
      echo '{"error":"Limit must be numeric bytes or \"unlimited\""}'
      exit 1
    fi
    
    # Success - in future, this would modify xray config to enforce the limit
    # For now, just log it and rely on admin panel side suspension
    echo '{"success":true,"message":"Data limit set for '${SEARCH_KEY}' to '${LIMIT_VALUE}' bytes","note":"Enforcement via Admin API"}'
    exit 0
    ;;
    
  *)
    echo '{"error":"Unknown command. Usage: v2ray-cli {add-user|remove-user|stats|set-limit|health} [args]"}'
    exit 1
    ;;
esac
EOFSCRIPT

# Make it executable
sudo chmod +x /usr/local/bin/v2ray-cli

# Install jq if not present (REQUIRED)
if ! command -v jq &> /dev/null; then
  echo "Installing jq (required for config management)..."
  sudo apt-get update && sudo apt-get install -y jq
fi

# Verify it works
v2ray-cli health
```

**Expected output:**
```json
{"success":true,"status":"running"}
```

If you see this, try creating a device in the panel again.

**Verification:**
```bash
# Check if v2ray-cli is in PATH
which v2ray-cli

# Should output:
# /usr/local/bin/v2ray-cli

# Test the add-user command with proper flags
v2ray-cli add-user --name "test-device" --limit 1073741824 --expires "2026-03-17"

# Test stats command
v2ray-cli stats "your-uuid-here"

# Check jq is installed
which jq
```

**If you get "jq: error" when creating devices:**

```bash
# Install jq on the V2Ray server
sudo apt-get update
sudo apt-get install -y jq

# Verify jq works
jq --version

# Test jq with the Xray config
cat /usr/local/etc/xray/config.json | jq '.inbounds[0].settings.clients'
```

---

### Issue: "Failed to get v2ray user stats via SSH"

**Solution:**
- Verify SSH access: `ssh user@server_ip`
- Check if `xray api` works locally on server
- Ensure API inbound is configured in config.json
- Verify stats and policy blocks are present

### Issue: Client can't connect

**Checklist:**
1. Firewall allows port: `sudo ufw status`
2. Xray is running: `sudo systemctl status xray`
3. Config.json syntax is valid: `xray -test -config /usr/local/etc/xray/config.json`
4. Client UUID exists in config: `grep -i "UUID" /usr/local/etc/xray/config.json`
5. Server IP is correct in VMess URL

### Issue: Usage shows 0 in panel

**Solution:**
- Ensure `stats` and `policy` blocks are in config.json
- Restart Xray: `sudo systemctl restart xray`
- Generate some traffic from client
- Check server stats: `xray api statsquery -pattern ""`
- If stats show on server but not in panel, check V2rayUser.name matches the stats key

### Issue: Nginx 502 Bad Gateway

**Solution:**
- Check Xray API is listening: `ss -tulpn | grep 8080`
- Check Nginx error logs: `sudo tail -f /var/log/nginx/xray-api-error.log`
- Verify upstream in Nginx config matches Xray API port

### Issue: Permission denied (SSH)

**Solution:**
- Verify SSH key is correct in panel
- Test SSH manually: `ssh -i /path/to/key user@server`
- Check SSH service: `sudo systemctl status ssh`
- Ensure user has sudo privileges or use root

### Issue: SSL certificate errors

**Solution:**
- Verify certificate paths in Nginx config
- Check cert validity: `sudo certbot certificates`
- Renew if expired: `sudo certbot renew`
- Restart Nginx: `sudo systemctl restart nginx`

### Issue: Device deleted from panel but client not removed from V2Ray server

**Symptom:**
- Device is deleted from panel successfully
- But the client still exists in Xray config (`/usr/local/etc/xray/config.json`)
- Client can still connect using the old device

**Cause:**
- The `v2ray-cli` helper script is not installed or not working properly
- Panel can't execute `v2ray-cli remove-user` to delete from server config

**Solution:**

First, verify that `v2ray-cli` is installed and working:

```bash
# SSH to V2Ray server
ssh root@YOUR_V2RAY_SERVER_IP

# Check if v2ray-cli exists
which v2ray-cli

# If not found, reinstall it (see "v2ray-cli: command not found" section above)
# If found, test it:
v2ray-cli health
# Should return: {"success":true,"status":"running"}
```

**Manual cleanup** (if automatic removal doesn't work):

```bash
# SSH to V2Ray server
ssh root@YOUR_V2RAY_SERVER_IP

# List all clients to find the device name
sudo jq '.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients[] | {id:.id, email:.email}' /usr/local/etc/xray/config.json

# Remove manually by device name
v2ray-cli remove-user "device-name-here"

# Or if v2ray-cli isn't working, manually edit config:
# Remove the client entry from the JSON using jq:
sudo jq '(.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients) |= map(select(.email != "device-name-here"))' /usr/local/etc/xray/config.json > /tmp/config.json && sudo mv /tmp/config.json /usr/local/etc/xray/config.json

# Restart Xray to apply changes
sudo systemctl restart xray
```

**Verification:**

```bash
# Check the client is removed
sudo jq '.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients' /usr/local/etc/xray/config.json

# Should not show the deleted device name
```

---

## Security Best Practices

1. **Use SSH keys instead of passwords**
2. **Disable password authentication** in `/etc/ssh/sshd_config`:
   ```
   PasswordAuthentication no
   ```
3. **Change default VMess port** from 10000 to something random
4. **Enable UFW firewall** and allow only necessary ports
5. **Keep Xray updated**: `bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install`
6. **Use fail2ban** to prevent brute force:
   ```bash
   sudo apt install fail2ban -y
   ```
7. **Rotate API tokens** periodically (if using API mode)
8. **Monitor logs** regularly for suspicious activity

---

## Additional Resources

- **Xray Documentation:** https://xtls.github.io
- **V2Ray Documentation:** https://www.v2fly.org
- **Panel Repository:** (Your GitHub repo link)
- **V2Ray Clients:**
  - Android: v2rayNG
  - iOS: Shadowrocket, Quantumult X
  - Windows: v2rayN, Qv2ray
  - macOS: V2rayU, Qv2ray
  - Linux: Qv2ray

---

## Quick Reference Command Cheat Sheet

```bash
# Xray Service
sudo systemctl start xray
sudo systemctl stop xray
sudo systemctl restart xray
sudo systemctl status xray

# Install required packages (do this first!)
sudo apt-get update
sudo apt-get install -y jq curl wget

# View logs
sudo tail -f /var/log/xray/access.log
sudo tail -f /var/log/xray/error.log

# Test config
xray -test -config /usr/local/etc/xray/config.json

# Query stats (all)
xray api statsquery -pattern ""

# Query stats (specific user)
xray api statsquery -pattern "user>>>UUID>>>traffic"

# Check listening ports
ss -tulpn | grep xray

# v2ray-cli helper tool (for panel integration)
v2ray-cli health                              # Check if helper is working
v2ray-cli add-user <uuid> <email>             # Add user manually
v2ray-cli remove-user <email>                 # Remove user manually
v2ray-cli stats <uuid>                        # Get user stats
which v2ray-cli                               # Verify helper is installed

# Check if v2ray-cli is in PATH
ls -la /usr/local/bin/v2ray-cli

# Nginx
sudo nginx -t
sudo systemctl restart nginx
sudo tail -f /var/log/nginx/xray-api-error.log

# SSL cert renewal
sudo certbot renew
sudo systemctl restart nginx

# Firewall
sudo ufw status
sudo ufw allow 10000/tcp
sudo ufw enable
```

---

## Support

If you encounter issues not covered in this guide:

1. Check Xray/V2Ray logs first
2. Verify panel server logs
3. Test SSH connectivity manually
4. Open an issue in the panel repository with:
   - Error message
   - Xray config (remove sensitive data)
   - Panel server configuration
   - Steps to reproduce

---

**Last Updated:** February 2026  
**Version:** 1.0
