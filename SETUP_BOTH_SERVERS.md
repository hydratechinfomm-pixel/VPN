# Complete Setup Guide: V2Ray Server + Management Panel

> **Step-by-step setup for both V2Ray server and Panel server using IP 52.220.233.195 with SSH keys**

This guide walks you through setting up:
1. **V2Ray/Xray Server** - Manages VPN connections
2. **Management Panel Server** - Controls and monitors V2Ray instances

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Admin Machine                       │
│                    (Windows/Mac/Linux)                      │
│                                                             │
│  • SSH client                                              │
│  • Browser (Panel UI)                                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    ┌──────────────┐       ┌──────────────────────┐
    │ V2Ray Server │       │ Panel Server         │
    │ 52.220.233.195     │ 52.220.233.195       │
    │ Port: 22           │ Port: 22  ← Panel    │
    │ Port: 10000 (VMess)│ Port: 5000 ← API    │
    │ Port: 8080 (API)   │ Port: 3000 ← Web    │
    └──────────────┘       └──────────────────────┘
```

**Option 1: Single Server** (Both on same IP)
- Run V2Ray on one port
- Run Panel on different port
- Simpler, cheaper

**Option 2: Two Servers** (Recommended production)
- Separate V2Ray server
- Separate Panel server
- Better security and scalability

This guide covers **Option 1 (Single Server)** since you have one IP.

---

## Prerequisites

**For Your Admin Machine:**
- OpenSSH client (Windows 10+, Mac, Linux have this built-in)
- A terminal/command prompt
- A text editor

**For the Server (52.220.233.195):**
- Ubuntu 20.04 / 22.04 or Debian 11+
- Root or sudo access
- Minimum 2GB RAM
- Minimum 20GB disk space
- Port 22 (SSH), 80, 443, 3000, 5000, 10000 open

---

## Part 1: Generate SSH Key (Admin Machine)

### For Windows (PowerShell)

```powershell
# Open PowerShell as Administrator

# Generate SSH key
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\vps_key" -N ""

# This creates two files:
# - C:\Users\YourUsername\.ssh\vps_key (private key - KEEP SECRET)
# - C:\Users\YourUsername\.ssh\vps_key.pub (public key - share with server)

# Display the public key
Get-Content "$env:USERPROFILE\.ssh\vps_key.pub"
# Copy the entire content
```

### For Mac/Linux

```bash
# Generate SSH key
ssh-keygen -t ed25519 -f ~/.ssh/vps_key -N ""

# Display the public key
cat ~/.ssh/vps_key.pub
# Copy the entire content
```

**Output will look like:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJx8... your@machine
```

---

## Part 2: Initial VPS Setup (52.220.233.195)

### Step 1: Connect to Your VPS

**Windows (PowerShell):**
```powershell
ssh -i "$env:USERPROFILE\.ssh\vps_key" root@52.220.233.195
```

**Mac/Linux:**
```bash
ssh -i ~/.ssh/vps_key root@52.220.233.195
```

When prompted "Are you sure you want to continue connecting?", type `yes`.

### Step 2: Setup SSH Key Authentication

Once logged in to the VPS, add your public key:

```bash
# Create SSH directory
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Add your public key
cat >> ~/.ssh/authorized_keys << 'EOF'
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJx8... your@machine
EOF

# Set correct permissions
chmod 600 ~/.ssh/authorized_keys

# Test: Open a new terminal and try to SSH again
# It should NOT ask for a password
```

Replace the `ssh-ed25519...` line with your actual public key from Step 1.

### Step 3: Disable Password Authentication (Security)

```bash
# Edit SSH configuration
sudo nano /etc/ssh/sshd_config

# Find and modify these lines:
# PasswordAuthentication no
# PubkeyAuthentication yes
# PermitRootLogin prohibit-password

# Save: Ctrl+X, Y, Enter

# Restart SSH
sudo systemctl restart ssh

# Verify you can still SSH with key
# (Test in a NEW terminal before closing this one!)
```

### Step 4: Update System & Install Essentials

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl wget git build-essential nodejs npm

# Verify installations
node --version
npm --version
```

### Step 5: Setup Firewall

```bash
sudo apt install ufw -y
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (critical!)
sudo ufw allow 22/tcp

# Allow Xray VMess
sudo ufw allow 10000/tcp

# Allow Panel web
sudo ufw allow 3000/tcp
sudo ufw allow 5000/tcp

# Allow HTTP/HTTPS (for Nginx, optional)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Part 3: Install & Configure Xray Server

### Step 1: Install Xray

```bash
# Download and run Xray installer
bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install

# Verify
xray version

# Enable autostart
sudo systemctl enable xray
```

### Step 2: Create Xray Configuration

```bash
# Create config directory
sudo mkdir -p /usr/local/etc/xray
sudo mkdir -p /var/log/xray
sudo chown root:root /var/log/xray

# Create config file
sudo nano /usr/local/etc/xray/config.json
```

Paste this config:

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

Save: `Ctrl+X`, `Y`, `Enter`

### Step 3: Start Xray

```bash
sudo systemctl start xray
sudo systemctl status xray

# Should show: "active (running)"
```

### Step 4: Test Xray API

```bash
# Query all stats
xray api statsquery -pattern ""

# Should return JSON like:
# {
#   "stat": [
#     {"name": "inbound>>>vmess-inbound>>>traffic>>>uplink", "value": 0},
#     ...
#   ]
# }
```

---

## Part 4: Install Node.js Panel Server

### Step 1: Create Panel Directory

```bash
# Create application directory
sudo mkdir -p /opt/vpn-panel
cd /opt/vpn-panel

# Download panel (or clone from your repo)
# If you have a Github repo:
sudo git clone https://github.com/your-username/vpn-panel.git .

# Or if you have a zip file, upload and extract:
# scp -i ~/.ssh/vps_key panel.zip root@52.220.233.195:/opt/vpn-panel/
# unzip panel.zip
```

### Step 2: Install Panel Dependencies

```bash
cd /opt/vpn-panel

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Go back to root
cd ..
```

### Step 3: Setup Environment Variables

```bash
# Create .env file in server directory
sudo nano server/.env
```

Paste this (adjust for your setup):

```env
# Server Configuration
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://localhost:27017/vpn-panel

# Panel URL (for CORS)
PANEL_URL=http://52.220.233.195:3000

# JWT Secret (generate with: openssl rand -hex 32)
JWT_SECRET=your_random_secret_here

# Encryption key (generate with: openssl rand -hex 32)
ENCRYPTION_KEY=your_random_encryption_key_here

# Admin user
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change_me_to_strong_password

# V2Ray Server Configuration
# This will be added via the panel UI, or:
V2RAY_SSH_HOST=52.220.233.195
V2RAY_SSH_PORT=22
V2RAY_SSH_USERNAME=root
V2RAY_SSH_KEY_PATH=/opt/vpn-panel/.ssh/vps_key
```

Generate secrets:

```bash
# Generate JWT secret
openssl rand -hex 32
# Copy the output and paste into JWT_SECRET=

# Generate encryption key
openssl rand -hex 32
# Copy the output and paste into ENCRYPTION_KEY=
```

Save: `Ctrl+X`, `Y`, `Enter`

### Step 4: Setup MongoDB

```bash
# Install MongoDB
sudo apt install -y mongodb

# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Verify
mongo --version
```

### Step 5: Setup SSH Key for Panel

The panel needs to connect to Xray via SSH. Copy the same key you use for management:

```bash
# Create SSH key directory for panel
sudo mkdir -p /opt/vpn-panel/.ssh
sudo chmod 700 /opt/vpn-panel/.ssh

# Copy your private key (from earlier)
# Option A: If you have the key file locally, upload it:
# scp -i ~/.ssh/vps_key ~/.ssh/vps_key root@52.220.233.195:/opt/vpn-panel/.ssh/

# Option B: Create it directly:
sudo nano /opt/vpn-panel/.ssh/vps_key
# Paste your PRIVATE key content
# Save: Ctrl+X, Y, Enter

# Set permissions
sudo chmod 600 /opt/vpn-panel/.ssh/vps_key
sudo chown -R root:root /opt/vpn-panel/.ssh
```

**Where to get your private key for uploading:**

On your admin machine:
- **Windows:** `C:\Users\YourUsername\.ssh\vps_key`
- **Mac/Linux:** `~/.ssh/vps_key`

Open it with a text editor and copy the entire content (including `-----BEGIN` and `-----END` lines).

### Step 6: Build & Run Panel

```bash
cd /opt/vpn-panel

# Build React frontend
cd client
npm run build

# Go back to root
cd ..

# Start server (test mode)
cd server
npm start

# Should show: "Server running on port 5000"
# Ctrl+C to stop
```

### Step 7: Setup PM2 for Auto-Start

```bash
# Install PM2 globally
sudo npm install -g pm2

# Create PM2 ecosystem config
sudo nano ecosystem.config.js
```

Paste:

```javascript
module.exports = {
  apps: [
    {
      name: "vpn-panel",
      script: "/opt/vpn-panel/server/index.js",
      instances: 1,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 5000
      },
      watch: false,
      error_file: "/var/log/vpn-panel-error.log",
      out_file: "/var/log/vpn-panel-out.log"
    }
  ]
};
```

Save: `Ctrl+X`, `Y`, `Enter`

Start with PM2:

```bash
# Start the app
sudo pm2 start ecosystem.config.js

# Check status
sudo pm2 status

# Save for autostart
sudo pm2 startup
sudo pm2 save

# View logs
sudo pm2 logs vpn-panel
```

### Step 8: Setup Nginx as Reverse Proxy (Optional but Recommended)

```bash
sudo apt install nginx -y

# Create Nginx config
sudo nano /etc/nginx/sites-available/vpn-panel
```

Paste:

```nginx
upstream vpn_panel {
    server 127.0.0.1:5000;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

    location / {
        proxy_pass http://vpn_panel;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    access_log /var/log/nginx/vpn-panel-access.log;
    error_log /var/log/nginx/vpn-panel-error.log;
}
```

Save: `Ctrl+X`, `Y`, `Enter`

Enable & start:

```bash
sudo ln -s /etc/nginx/sites-available/vpn-panel /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

---

## Part 5: Access Panel & Add V2Ray Server

### Step 1: Access the Panel

Open your browser and go to:
```
http://52.220.233.195:3000
```

Or if using Nginx on port 80:
```
http://52.220.233.195
```

### Step 2: Login

Default credentials (change these immediately):
- **Email:** `admin@example.com`
- **Password:** `change_me_to_strong_password` (or what you set in `.env`)

### Step 3: Add V2Ray Server

1. Click **Servers** → **Add Server**
2. Fill in:
   - **Name:** V2Ray Server 1
   - **Host:** `52.220.233.195`
   - **Port:** `10000`
   - **Region:** Your region
   - **VPN Type:** `v2ray`
   - **V2Ray Access Method:** `SSH`
   - **SSH Host:** `52.220.233.195`
   - **SSH Port:** `22`
   - **SSH Username:** `root`
   - **SSH Private Key:** Paste content of `/opt/vpn-panel/.ssh/vps_key`

3. Click **Save**

### Step 4: Test Connection

After saving, the panel should test the connection. You should see:
```
✓ Connection successful
```

### Step 5: Create a Device

1. Click **Devices** → **Add Device**
2. Fill in:
   - **Name:** Test Device
   - **Server:** V2Ray Server 1
   - **Plan:** (select a plan or create one first)
3. Click **Save**

The panel will:
- Generate a UUID
- Add the user to Xray via SSH
- Return a VMess URL and QR code

---

## Part 6: Verify Everything Works

### Test 1: Check Xray has the new user

```bash
# SSH into server
ssh -i ~/.ssh/vps_key root@52.220.233.195

# Check the config
cat /usr/local/etc/xray/config.json | grep -A 10 "clients"

# Should show your newly created user
```

### Test 2: Check stats are working

```bash
# Query Xray stats
xray api statsquery -pattern ""

# Should return JSON with stats
```

### Test 3: Connect a client

1. Download the VMess URL or QR code from the panel
2. Install a V2Ray client:
   - **Android:** v2rayNG
   - **Windows:** v2rayN or Qv2ray
   - **Mac:** V2rayU
   - **Linux:** Qv2ray
3. Import the config
4. Connect
5. Check your IP: Visit https://ip.sb

### Test 4: Monitor usage in panel

After client uses some traffic:
1. Go to **Devices** in panel
2. Refresh the page
3. Usage should update automatically

---

## Part 7: Maintenance & Common Tasks

### View Panel Logs

```bash
# Real-time logs
sudo pm2 logs vpn-panel

# Xray logs
sudo tail -f /var/log/xray/error.log

# Nginx logs
sudo tail -f /var/log/nginx/vpn-panel-error.log
```

### Restart Services

```bash
# Restart Xray
sudo systemctl restart xray

# Restart Panel
sudo pm2 restart vpn-panel

# Restart Nginx
sudo systemctl restart nginx
```

### Update Panel

```bash
cd /opt/vpn-panel
git pull
npm install
npm run build
sudo pm2 restart vpn-panel
```

### Backup Important Data

```bash
# Backup MongoDB
sudo mongodump --out /backup/mongo-$(date +%Y%m%d)

# Backup Xray config
sudo cp /usr/local/etc/xray/config.json /backup/xray-config-$(date +%Y%m%d).json
```

### Increase V2Ray User Limit

If you need more concurrent connections, edit config.json:

```json
{
  "inbounds": [//connect data from client app
    {
      "tag": "vmess-inbound",
      "listen": "0.0.0.0",
      "port": 10000, 
      "protocol": "vmess",
      "settings": {
        "clients": [],
        "disableInsecureEncryption": false
      },
      "streamSettings": {
        "network": "tcp",
        "tcpSettings": {
          "header": {
            "type": "none"
          }
        }
      }
    }
  ]
}
```

Then restart:
```bash
sudo systemctl restart xray
```

---

## Troubleshooting

### Panel can't connect to Xray via SSH

```bash
# Test SSH connectivity
ssh -i /opt/vpn-panel/.ssh/vps_key root@52.220.233.195

# If error, check SSH key permissions
ls -la ~/.ssh/vps_key
# Should be: -rw------- (600)

# Make sure SSH is accepting key auth
sudo nano /etc/ssh/sshd_config
# PubkeyAuthentication yes
# Then restart: sudo systemctl restart ssh
```

### Port 3000 not accessible

```bash
# Check if panel is running
sudo pm2 status

# Check firewall
sudo ufw status

# Check if Nginx is running
sudo systemctl status nginx

# Check port is listening
ss -tulpn | grep 5000
ss -tulpn | grep 80
```

### MongoDB connection error

```bash
# Check MongoDB is running
sudo systemctl status mongodb

# Check logs
sudo tail -f /var/log/mongodb/mongod.log

# Restart if needed
sudo systemctl restart mongodb
```

### Xray not accepting new users

```bash
# Check Xray status
sudo systemctl status xray

# Check config syntax
xray -test -config /usr/local/etc/xray/config.json

# Check logs
sudo tail -f /var/log/xray/error.log

# Restart
sudo systemctl restart xray
```

---

## Security Checklist

- [ ] SSH password authentication disabled
- [ ] Firewall enabled and configured
- [ ] Change admin password immediately
- [ ] Regular backups scheduled
- [ ] Monitor logs regularly
- [ ] Update system monthly: `sudo apt update && sudo apt upgrade`
- [ ] Use HTTPS for panel (install SSL certificate)
- [ ] Keep panel and Xray updated
- [ ] Rotate SSH keys regularly

---

## Next Steps

1. **Setup HTTPS** for panel:
   ```bash
   sudo apt install certbot python3-certbot-nginx -y
   sudo certbot certonly --nginx -d your-domain.com
   ```

2. **Setup custom domain** instead of IP

3. **Create multiple V2Ray servers** for load balancing

4. **Configure backup scripts** for automatic daily backups

5. **Monitor server health** with Prometheus/Grafana

6. **Setup alerts** for server downtime

---

## Useful Commands Reference

```bash
# SSH with key (admin machine)
ssh -i ~/.ssh/vps_key root@52.220.233.195

# Xray commands
sudo systemctl start|stop|restart|status xray
xray -test -config /usr/local/etc/xray/config.json
xray api statsquery -pattern ""

# Panel commands
sudo pm2 start|stop|restart|status vpn-panel
sudo pm2 logs vpn-panel

# MongoDB commands
mongo
db.devices.find()
db.servers.find()

# Monitoring
ps aux | grep xray
ps aux | grep node
ss -tulpn | grep LISTEN
df -h
free -h
```

---

**Congratulations!** Your VPN panel and Xray server are now running!

For questions or issues, check the troubleshooting section or review the complete V2RAY_SERVER_COMPLETE_SETUP.md guide.

**Last Updated:** February 2026
