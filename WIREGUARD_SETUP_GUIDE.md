# WireGuard VPN Control Panel - Setup Guide

## Prerequisites
- Ubuntu 24.04 server with root/sudo access
- Node.js 16+ installed
- MongoDB installed and running
- Basic knowledge of Linux commands

---

## Part 1: WireGuard Server Installation (Ubuntu 24.04)

### Step 1: Update System
```bash
sudo apt update
sudo apt upgrade -y
```

### Step 2: Install WireGuard
```bash
# Install WireGuard and tools
sudo apt install wireguard wireguard-tools -y

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv6.conf.all.forwarding=1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Step 3: Generate Server Keys
```bash
# Create WireGuard directory
sudo mkdir -p /etc/wireguard
cd /etc/wireguard

# Generate private key
sudo wg genkey | sudo tee server_private.key

# Generate public key from private key
sudo cat server_private.key | sudo wg pubkey | sudo tee server_public.key

# Set proper permissions
sudo chmod 600 server_private.key
sudo chmod 644 server_public.key
```

### Step 4: Configure WireGuard Interface
```bash
# Create configuration file
sudo nano /etc/wireguard/wg0.conf
```

Add the following configuration (adjust IPs and port as needed):
```ini
[Interface]
# Server private key (from server_private.key file)
PrivateKey = YOUR_SERVER_PRIVATE_KEY_HERE

# Server IP address in the VPN network (MUST be 10.0.0.1 for /24 range)
Address = 10.0.0.1/24

# Port WireGuard will listen on
ListenPort = 51820

# Enable NAT (if you want clients to access internet)
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# DNS (optional)
# DNS = 8.8.8.8, 8.8.4.4
```

**Important:** 
- Replace `YOUR_SERVER_PRIVATE_KEY_HERE` with the content from `/etc/wireguard/server_private.key`
- Replace `eth0` with your actual network interface name (check with `ip addr` or `ifconfig`)
- Adjust `10.0.0.1/24` to match your desired VPN IP range

### Step 5: Enable and Start WireGuard
```bash
# Enable WireGuard to start on boot
sudo systemctl enable wg-quick@wg0

# Start WireGuard
sudo systemctl start wg-quick@wg0

# Check status
sudo systemctl status wg-quick@wg0
sudo wg show
```

### Step 6: Configure Firewall (UFW)
```bash
# Allow WireGuard port
sudo ufw allow 51820/udp

# If using UFW, allow forwarding
sudo nano /etc/default/ufw
# Change DEFAULT_FORWARD_POLICY from DROP to ACCEPT

# Reload UFW
sudo ufw reload
```

### Step 7: Verify Installation
```bash
# Check WireGuard is running
sudo wg show

# Check interface is up
ip addr show wg0

# Test connectivity (from another machine)
# ping 10.0.0.1
```

---

## Part 2: Control Panel Setup

### Step 1: Install Dependencies
```bash
# In the project root directory
npm install

# In the client directory
cd client
npm install
cd ..
```

### Step 2: Environment Configuration

Create `.env` file in the root directory:
```bash
cp .env.example .env  # If you have an example file
# Or create new .env file
nano .env
```

### Step 3: .env File Configuration

Create/update `.env` file with the following:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/wireguard-vpn
# Or for remote MongoDB:
# MONGODB_URI=mongodb://username:password@host:port/database

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:3000

# WireGuard Default Settings
WG_DEFAULT_INTERFACE=wg0
WG_DEFAULT_IP_RANGE=10.0.0.0/24
WG_DEFAULT_PORT=51820
```

### Step 4: Database Setup

Ensure MongoDB is running:
```bash
# Check MongoDB status
sudo systemctl status mongod

# If not running, start it
sudo systemctl start mongod
sudo systemctl enable mongod
```

### Step 5: Initialize Database

The application will automatically create collections on first run. You can also manually create an admin user:

```bash
# Start the server once to initialize
npm start

# Or use MongoDB shell to create admin user
mongosh wireguard-vpn
```

In MongoDB shell:
```javascript
use wireguard-vpn
db.users.insertOne({
  username: "admin",
  email: "admin@example.com",
  password: "$2a$10$...", // Use bcrypt hash
  role: "admin",
  isActive: true,
  createdAt: new Date()
})
```

**Better approach:** Use the registration endpoint or create a setup script.

---

## Part 3: Server Configuration in Control Panel

### Step 1: Start the Application

```bash
# Terminal 1: Start backend
npm start
# Or for development:
npm run dev

# Terminal 2: Start frontend
cd client
npm start
```

### Step 2: Access Control Panel

1. Open browser: `http://localhost:3000`
2. Register a new admin account (first user will be admin)
3. Or login with existing credentials

### Step 3: Add WireGuard Server

1. Go to **Servers** page (Admin only)
2. Click **Add Server**
3. Fill in the form:

**For Local Server (same machine):**
- **Name**: My WireGuard Server
- **Host**: Your server IP or domain
- **Port**: 51820
- **Region**: Select appropriate region
- **Provider**: Select provider
- **Access Method**: Local
- **Interface Name**: wg0
- **VPN IP Range**: 10.0.0.0/24
- **WireGuard Port**: 51820
- **Server Public Key**: Copy from `/etc/wireguard/server_public.key`

**For Remote Server (SSH):**
- **Name**: Remote WireGuard Server
- **Host**: Server IP or domain
- **Port**: 51820
- **Access Method**: SSH
- **SSH Host**: Server IP
- **SSH Port**: 22
- **SSH Username**: your_username
- **SSH Password**: your_password (or use private key)
- **Interface Name**: wg0
- **VPN IP Range**: 10.0.0.0/24
- **WireGuard Port**: 51820
- **Server Public Key**: Copy from remote server

### Step 4: Test Server Connection

1. After adding server, click **Health Check**
2. Verify server status shows as "Healthy"
3. Check WireGuard status shows running

---

## Part 4: Setup Checklist

### Server Setup
- [ ] Ubuntu 24.04 server ready
- [ ] WireGuard installed (`sudo apt install wireguard wireguard-tools`)
- [ ] IP forwarding enabled (`net.ipv4.ip_forward=1`)
- [ ] Server keys generated (`wg genkey`, `wg pubkey`)
- [ ] WireGuard config file created (`/etc/wireguard/wg0.conf`)
- [ ] WireGuard service started (`systemctl start wg-quick@wg0`)
- [ ] Firewall configured (port 51820/udp open)
- [ ] WireGuard status verified (`wg show`)

### Control Panel Setup
- [ ] Node.js installed (v16+)
- [ ] MongoDB installed and running
- [ ] Project dependencies installed (`npm install`)
- [ ] Client dependencies installed (`cd client && npm install`)
- [ ] `.env` file created and configured
- [ ] MongoDB connection string set in `.env`
- [ ] JWT secret key set in `.env` (strong random string)
- [ ] Backend server starts without errors
- [ ] Frontend starts without errors

### Application Configuration
- [ ] Admin account created (first user or via registration)
- [ ] WireGuard server added in control panel
- [ ] Server connection tested (health check passes)
- [ ] Server public key added to control panel
- [ ] Test device created
- [ ] Device config downloaded and tested
- [ ] QR code generated and scanned (if using mobile)

### Security Checklist
- [ ] Strong JWT secret in production
- [ ] MongoDB authentication enabled (production)
- [ ] Firewall rules configured
- [ ] SSH keys used instead of passwords (for remote servers)
- [ ] Server private keys secured (600 permissions)
- [ ] HTTPS enabled (production)
- [ ] CORS configured properly
- [ ] Environment variables secured (not in git)

### Testing Checklist
- [ ] Create a device
- [ ] Download device config
- [ ] Generate QR code
- [ ] Import config to WireGuard client
- [ ] Verify connection works
- [ ] Check usage tracking
- [ ] Test plan assignment
- [ ] Test device enable/disable
- [ ] Test force disconnect
- [ ] Verify cron jobs running (usage sync, health checks)

---

## Part 5: Troubleshooting

### WireGuard Not Starting
```bash
# Check status
sudo systemctl status wg-quick@wg0

# Check logs
sudo journalctl -u wg-quick@wg0 -n 50

# Verify config syntax
sudo wg-quick strip wg0
```

### Cannot Connect to Server
- Check firewall: `sudo ufw status`
- Verify port is open: `sudo netstat -ulnp | grep 51820`
- Check WireGuard is running: `sudo wg show`
- Verify server public key matches

### Control Panel Issues
- Check MongoDB connection: `mongosh wireguard-vpn`
- Verify .env file exists and has correct values
- Check backend logs for errors
- Verify JWT secret is set
- Check CORS configuration

### Device Connection Issues
- Verify device public key matches server
- Check device IP is in correct range
- Verify server endpoint is correct
- Check firewall rules
- Test with `wg show` on server

---

## Part 6: Production Deployment

### Security Hardening
1. Use strong passwords/keys
2. Enable MongoDB authentication
3. Use HTTPS (Let's Encrypt)
4. Configure proper firewall rules
5. Regular backups
6. Monitor logs
7. Keep system updated

### Performance Optimization
1. Use PM2 for process management
2. Enable MongoDB indexes
3. Configure reverse proxy (Nginx)
4. Use CDN for static assets
5. Enable compression

### Backup Strategy
1. Database backups (MongoDB)
2. WireGuard config backups
3. Server keys backup (secure location)
4. Application code backup

---

## Quick Start Commands

```bash
# Install WireGuard
sudo apt update && sudo apt install wireguard wireguard-tools -y

# Setup WireGuard
cd /etc/wireguard
sudo wg genkey | sudo tee server_private.key
sudo cat server_private.key | sudo wg pubkey | sudo tee server_public.key
sudo chmod 600 server_private.key

# Create config (edit with your details)
sudo nano /etc/wireguard/wg0.conf

# Enable and start
sudo systemctl enable wg-quick@wg0
sudo systemctl start wg-quick@wg0

# Install control panel dependencies
npm install
cd client && npm install && cd ..

# Create .env file
nano .env

# Start application
npm start
# In another terminal: cd client && npm start
```

---

## Support

For issues or questions:
1. Check WireGuard logs: `sudo journalctl -u wg-quick@wg0`
2. Check application logs: Backend console output
3. Verify configuration files
4. Test connectivity step by step
