# WireGuard Control Panel - Setup Checklist

Use this checklist to ensure everything is properly configured.

## Phase 1: Server Preparation

### Ubuntu 24.04 Server
- [ ] Server has root/sudo access
- [ ] System updated (`sudo apt update && sudo apt upgrade`)
- [ ] Firewall configured (UFW or iptables)
- [ ] SSH access working
- [ ] Server IP address noted
- [ ] Domain name configured (if using)

### Network Configuration
- [ ] Server has static IP (recommended)
- [ ] Port 51820/udp is open in firewall
- [ ] Port 22/tcp is open for SSH (if remote)
- [ ] IP forwarding enabled (`net.ipv4.ip_forward=1`)

---

## Phase 2: WireGuard Installation

### Installation
- [ ] WireGuard installed (`sudo apt install wireguard wireguard-tools`)
- [ ] WireGuard tools verified (`wg --version`)

### Key Generation
- [ ] Server private key generated (`wg genkey`)
- [ ] Server public key generated (`wg pubkey`)
- [ ] Keys saved securely
- [ ] Key permissions set (600 for private, 644 for public)

### Configuration
- [ ] WireGuard config file created (`/etc/wireguard/wg0.conf`)
- [ ] Private key added to config
- [ ] Server IP address set (e.g., 10.0.0.1/24)
- [ ] Listen port set (51820)
- [ ] NAT rules configured (if needed)
- [ ] Network interface name correct (eth0, ens3, etc.)

### Service Setup
- [ ] WireGuard service enabled (`systemctl enable wg-quick@wg0`)
- [ ] WireGuard service started (`systemctl start wg-quick@wg0`)
- [ ] Service status verified (`systemctl status wg-quick@wg0`)
- [ ] Interface verified (`ip addr show wg0`)
- [ ] WireGuard status checked (`wg show`)

---

## Phase 3: Control Panel Installation

### Prerequisites
- [ ] Node.js installed (v16 or higher)
- [ ] npm installed
- [ ] MongoDB installed
- [ ] MongoDB service running
- [ ] Git installed (if cloning from repo)

### Project Setup
- [ ] Project files downloaded/cloned
- [ ] Root directory dependencies installed (`npm install`)
- [ ] Client directory dependencies installed (`cd client && npm install`)
- [ ] All dependencies installed without errors

### Environment Configuration
- [ ] `.env` file created in root directory
- [ ] `NODE_ENV` set (development/production)
- [ ] `PORT` configured (default: 5000)
- [ ] `MONGODB_URI` configured correctly
- [ ] `JWT_SECRET` set (strong random string, min 32 chars)
- [ ] `JWT_EXPIRES_IN` configured
- [ ] `CLIENT_URL` set for CORS
- [ ] WireGuard defaults configured (if needed)

### Database Setup
- [ ] MongoDB connection tested
- [ ] Database created/accessible
- [ ] Collections will be auto-created on first run

---

## Phase 4: Application Configuration

### First Run
- [ ] Backend server starts (`npm start`)
- [ ] No startup errors
- [ ] Server listening on configured port
- [ ] Frontend starts (`cd client && npm start`)
- [ ] Frontend accessible in browser

### User Setup
- [ ] Admin account created (first registration or manual)
- [ ] Can login with admin account
- [ ] Admin role verified

### Server Configuration in Panel
- [ ] Navigate to Servers page
- [ ] Add WireGuard server
- [ ] Fill in server details:
  - [ ] Server name
  - [ ] Host/IP address
  - [ ] Port (51820)
  - [ ] Region
  - [ ] Provider
  - [ ] Access method (Local/SSH)
- [ ] SSH credentials (if remote):
  - [ ] SSH host
  - [ ] SSH port
  - [ ] SSH username
  - [ ] SSH password/key
- [ ] WireGuard settings:
  - [ ] Interface name (wg0)
  - [ ] VPN IP range (10.0.0.0/24)
  - [ ] WireGuard port (51820)
  - [ ] Server public key (from server_public.key)
- [ ] Server saved successfully
- [ ] Health check passes
- [ ] WireGuard status shows running

---

## Phase 5: Device Management

### Create Test Device
- [ ] Navigate to Devices page
- [ ] Click "Add Device"
- [ ] Fill device form:
  - [ ] Device name
  - [ ] Server selection
  - [ ] Plan selection (optional)
  - [ ] Data limit (optional)
- [ ] Device created successfully
- [ ] Device appears in list
- [ ] VPN IP assigned automatically

### Device Configuration
- [ ] Download config file (`.conf`)
- [ ] Config file format correct
- [ ] QR code generated
- [ ] QR code displays correctly
- [ ] Config contains correct:
  - [ ] Private key
  - [ ] VPN IP address
  - [ ] Server public key
  - [ ] Server endpoint
  - [ ] Allowed IPs

### Device Testing
- [ ] Import config to WireGuard client
- [ ] Connect to VPN
- [ ] Connection successful
- [ ] Can access internet (if NAT configured)
- [ ] Usage tracking working
- [ ] Device shows as connected in panel

---

## Phase 6: Plan Management

### Create Plans
- [ ] Navigate to Plans page (Admin)
- [ ] Create plan:
  - [ ] Plan name
  - [ ] Description
  - [ ] Data limit (GB or unlimited)
  - [ ] Price (optional)
  - [ ] Billing cycle
  - [ ] Features
- [ ] Plan saved successfully
- [ ] Plan appears in list

### Assign Plan to Device
- [ ] Select device
- [ ] Assign plan
- [ ] Plan assigned successfully
- [ ] Device shows plan in list
- [ ] Data limit enforced (if set)

---

## Phase 7: Monitoring & Maintenance

### Health Checks
- [ ] Server health check working
- [ ] Health status updates automatically
- [ ] Unhealthy servers detected

### Usage Tracking
- [ ] Usage sync cron job running
- [ ] Device usage updates (every 5 minutes)
- [ ] Usage displayed correctly
- [ ] Plan limits enforced
- [ ] Devices auto-disabled when limit exceeded

### Cron Jobs
- [ ] Usage sync scheduled (every 5 min)
- [ ] Health checks scheduled (every 5 min)
- [ ] Device expiration scheduled (daily)
- [ ] Plan enforcement scheduled (every 10 min)

---

## Phase 8: Security

### Server Security
- [ ] Strong passwords/keys used
- [ ] SSH keys configured (instead of passwords)
- [ ] Firewall properly configured
- [ ] Unnecessary ports closed
- [ ] System updates applied
- [ ] Server private keys secured (600 permissions)

### Application Security
- [ ] Strong JWT secret (32+ characters)
- [ ] MongoDB authentication enabled (production)
- [ ] CORS properly configured
- [ ] Environment variables secured
- [ ] `.env` file not in git
- [ ] HTTPS enabled (production)
- [ ] Rate limiting configured (if needed)

### Access Control
- [ ] Admin routes protected
- [ ] User routes protected
- [ ] Device access restricted to owners
- [ ] API endpoints authenticated

---

## Phase 9: Production Deployment

### Pre-Deployment
- [ ] All tests passing
- [ ] Security audit completed
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Logging configured

### Deployment
- [ ] Production environment variables set
- [ ] MongoDB production instance configured
- [ ] HTTPS/SSL certificates installed
- [ ] Reverse proxy configured (Nginx)
- [ ] Process manager configured (PM2)
- [ ] Auto-restart on failure enabled
- [ ] Log rotation configured

### Post-Deployment
- [ ] Application accessible
- [ ] All features working
- [ ] Performance acceptable
- [ ] Monitoring active
- [ ] Backups running
- [ ] Documentation updated

---

## Phase 10: Testing

### Functional Testing
- [ ] Create device
- [ ] Edit device
- [ ] Delete device
- [ ] Enable/disable device
- [ ] Force disconnect device
- [ ] Download config
- [ ] Generate QR code
- [ ] Create plan
- [ ] Assign plan
- [ ] View usage
- [ ] Server health check
- [ ] User management

### Connection Testing
- [ ] Device connects successfully
- [ ] Internet access works (if NAT enabled)
- [ ] Multiple devices can connect
- [ ] Usage tracking accurate
- [ ] Plan limits enforced
- [ ] Device disconnect works

### Edge Cases
- [ ] No available IPs handled
- [ ] Server offline handled
- [ ] Invalid config handled
- [ ] Expired devices handled
- [ ] Limit exceeded handled

---

## Quick Verification Commands

```bash
# Check WireGuard
sudo wg show
sudo systemctl status wg-quick@wg0

# Check MongoDB
sudo systemctl status mongod
mongosh wireguard-vpn

# Check Node.js
node --version
npm --version

# Check application
curl http://localhost:5000/health

# Check firewall
sudo ufw status
sudo netstat -ulnp | grep 51820
```

---

## Notes

- Mark items as complete as you finish them
- Some items depend on others (follow order)
- Test each phase before moving to next
- Keep backups of important configurations
- Document any custom configurations
