# API Mode Setup - Using HTTP Wrapper

This guide sets up **API Base URL mode** by creating an HTTP wrapper around v2ray-cli.

## Architecture

```
Panel (localhost:5000)
  ↓
Nginx HTTPS (114.29.236.236:443)
  ↓
HTTP Wrapper (127.0.0.1:6000) ← translates HTTP to v2ray-cli
  ↓
v2ray-cli (local commands)
  ↓
Xray gRPC API (127.0.0.1:8080)
```

## Step 1: Install Node Dependencies on V2Ray Server

```bash
ssh root@114.29.236.236

# Check if Node.js is installed
node --version

# If not installed, install it:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

## Step 2: Create HTTP Wrapper Service

```bash
# On V2Ray server (114.29.236.236):

sudo tee /usr/local/bin/v2ray-http-api.js > /dev/null <<'EOFAPI'
const express = require('express');
const { execSync } = require('child_process');
const app = express();

app.use(express.json());

function executeV2rayCli(cmd) {
  try {
    const output = execSync(`v2ray-cli ${cmd}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(output.trim());
  } catch (err) {
    throw new Error(`v2ray-cli failed: ${err.message}`);
  }
}

app.post('/users', (req, res) => {
  try {
    const { name, limit, expiresAt } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });

    let cmd = `add-user --name "${name}"`;
    if (limit) cmd += ` --limit ${limit}`;
    if (expiresAt) cmd += ` --expires "${expiresAt}"`;

    const result = executeV2rayCli(cmd);
    res.json({ success: true, id: result.userId, userId: result.userId, email: name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/users/:email', (req, res) => {
  try {
    const result = executeV2rayCli(`remove-user "${req.params.email}"`);
    res.json({ success: true, email: req.params.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/stats/:email', (req, res) => {
  try {
    const result = executeV2rayCli(`stats "${req.params.email}"`);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  try {
    executeV2rayCli('health');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(503).json({ error: 'v2ray-cli unavailable' });
  }
});

app.listen(6000, '127.0.0.1', () => {
  console.log('✓ HTTP API wrapper on 127.0.0.1:6000');
});
EOFAPI

sudo chmod +x /usr/local/bin/v2ray-http-api.js

# Test it works
node /usr/local/bin/v2ray-http-api.js &
sleep 2

# Test the health endpoint
curl http://127.0.0.1:6000/health

# Kill the test process
pkill -f v2ray-http-api.js
```

## Step 3: Create Systemd Service

```bash
# On V2Ray server:

sudo tee /etc/systemd/system/v2ray-http-api.service > /dev/null <<'EOFSERVICE'
[Unit]
Description=Xray HTTP API Wrapper
After=xray.service
Wants=xray.service

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /usr/local/bin/v2ray-http-api.js
Restart=on-failure
RestartSec=5s
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOFSERVICE

sudo systemctl daemon-reload
sudo systemctl enable v2ray-http-api
sudo systemctl start v2ray-http-api

# Verify it's running
sudo systemctl status v2ray-http-api
```

## Step 4: Update Nginx to Proxy to HTTP Wrapper

```bash
# On V2Ray server:

sudo tee /etc/nginx/sites-available/xray-api > /dev/null <<'EOFNGINX'
upstream xray_http_api {
    server 127.0.0.1:6000;
}

server {
    listen 80;
    listen [::]:80;
    server_name 114.29.236.236 _;
    
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
    
    set $api_token "139bf2b29eaad3dc71ca54856dccf6e0688f34a00d982f550329f5b49f50bcb4";
    
    # Health check (no auth)
    location /health {
        access_log off;
        proxy_pass http://xray_http_api;
    }
    
    # API endpoints (with token auth)
    location / {
        # Validate Bearer token
        if ($http_authorization !~ "^Bearer (.+)$") {
            return 401;
        }
        
        set $auth_token "";
        if ($http_authorization ~ "^Bearer (.+)$") {
            set $auth_token $1;
        }
        
        if ($auth_token != $api_token) {
            return 401;
        }
        
        # Proxy to HTTP wrapper
        proxy_pass http://xray_http_api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffering off;
    }
    
    access_log /var/log/nginx/xray-api-access.log;
    error_log /var/log/nginx/xray-api-error.log;
}
EOFNGINX

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

## Step 5: Ensure Panel Uses API Mode

```bash
# On panel server, update database:

mongosh <<'MONGOEOF'
use vpn_panel_db

db.vpnservers.updateOne(
  {host: "114.29.236.236"},
  {$set: {
    "v2ray.accessMethod": "api",
    "v2ray.apiBaseUrl": "https://114.29.236.236:443",
    "v2ray.apiPort": 443,
    "v2ray.apiToken": "ENC:BY0Gvxq0Mz6e/OXENZ3numdden+NsLGKJ1S4Y94rbqcx/r/7BXVr91DhG17qxt0gysS9NWv+rk+Zjl3GvSxvIwZ4fZasF+rflfsAa+efeHgZgBTE/p+4+oUk9WM=",
    "v2ray.tlsVerify": false
  }}
)

// Verify
db.vpnservers.findOne({host: "114.29.236.236"}).v2ray

MONGOEOF
```

## Step 6: Test API Connection

```bash
# From panel server:

# Test health endpoint (no auth)
curl -k https://114.29.236.236/health
# Expected: {"status":"ok"}

# Test with auth
curl -k -X POST https://114.29.236.236/users \
  -H "Authorization: Bearer 139bf2b29eaad3dc71ca54856dccf6e0688f34a00d982f550329f5b49f50bcb4" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-api-user","limit":1073741824}'

# Expected: {"success":true,"id":"<uuid>","userId":"<uuid>","email":"test-api-user"}
```

## Step 7: Create Device in Panel

Now try creating a device in the panel:
- Server: V2Ray Server - SG (114.29.236.236)
- Plan: Any plan
- Click Create

The flow will be:
1. Panel sends HTTP POST to https://114.29.236.236:443/users
2. Nginx validates Bearer token
3. Nginx proxies to http://127.0.0.1:6000/users
4. HTTP wrapper translates to: `v2ray-cli add-user --name "..."`
5. Device created successfully!

## Troubleshooting

### HTTP wrapper not starting

```bash
# Check if Node.js can run it
node /usr/local/bin/v2ray-http-api.js

# Check systemd logs
sudo journalctl -u v2ray-http-api -f

# Verify v2ray-cli is in PATH
v2ray-cli health
```

### Nginx still returning 401

```bash
# Check token in Nginx config
sudo grep "set \$api_token" /etc/nginx/sites-available/xray-api

# Check Nginx error log
sudo tail -f /var/log/nginx/xray-api-error.log

# Manually test the wrapper
curl http://127.0.0.1:6000/health
```

### Device creation still fails

```bash
# Check HTTP wrapper logs
sudo journalctl -u v2ray-http-api -n 50

# Test v2ray-cli directly
v2ray-cli add-user --name "debug-test"
```

---

**Summary:**
- ✅ Nginx proxies HTTPS to HTTP wrapper
- ✅ HTTP wrapper translates HTTP to v2ray-cli commands  
- ✅ Panel uses API Base URL mode (https://114.29.236.236:443)
- ✅ Token authentication validates all requests
- ✅ Device creation works through full API chain
