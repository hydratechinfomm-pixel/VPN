# V2Ray Cloudflare Proxy Setup Guide

## Overview

This guide explains how to set up V2Ray with Cloudflare proxy support (WebSocket + TLS) for better censorship resistance and CDN protection.

## Configuration Comparison

### ❌ Non-Working Config (Direct TCP)
```json
{
  "v": 2,
  "ps": "d",
  "add": "mingalarpar.news",
  "port": 443,
  "id": "9494f297-3989-40c0-81e3-0788a3252418",
  "alterId": 0,
  "net": "tcp",        // ❌ Direct TCP connection
  "type": "none",
  "host": "mingalarpar.news"
}
```

### ✅ Working Config (WebSocket + TLS via Cloudflare)
```json
{
  "mode": "",
  "fp": "chrome",                              // ✅ Browser fingerprint
  "v": "2",
  "add": "mingalarpar.news",
  "serviceName": "none",
  "id": "9494f297-3989-40c0-81e3-0788a3252418",
  "sni": "mingalarpar.news",                   // ✅ SNI for TLS
  "fragment": "",
  "tls": "tls",                                // ✅ TLS enabled
  "deviceID": "",
  "seed": "",
  "port": "443",
  "ps": "d",
  "type": "none",
  "path": "/vpn",                              // ✅ WebSocket path
  "aid": "0",
  "headerType": "",
  "alpn": "h2,http/1.1",                       // ✅ HTTP/2 and HTTP/1.1
  "net": "ws",                                 // ✅ WebSocket protocol
  "extra": "",
  "host": "mingalarpar.news"
}
```

## Key Differences

| Field | TCP (Non-Working) | WebSocket + TLS (Working) |
|-------|-------------------|---------------------------|
| `net` | `tcp` | `ws` (WebSocket) |
| `tls` | Not set | `tls` |
| `path` | Not set | `/vpn` |
| `sni` | Not set | `mingalarpar.news` |
| `alpn` | Not set | `h2,http/1.1` |
| `fp` | Not set | `chrome` |

---

## Server Setup Steps

### 1. Add V2Ray Server in Panel

Navigate to **Servers** → **Add Server** → Select **V2Ray (VMess)**

#### Basic Settings
- **Name**: `My V2Ray CF Server`
- **Host**: `mingalarpar.news` (your Cloudflare proxied domain)
- **Port**: `443` (Cloudflare HTTPS port)
- **Public Host**: `mingalarpar.news` (domain advertised to clients)

#### Cloudflare Proxy / TLS Settings

**✅ Enable TLS** (required for Cloudflare proxy)

- **Network Type**: `WebSocket (CF proxy)` ⬅️ **IMPORTANT**
- **WebSocket Path**: `/vpn` (or any custom path like `/ws`, `/v2ray`)
- **SNI (Server Name Indication)**: `mingalarpar.news` (same as domain)
- **Client Fingerprint**: `Chrome` (recommended for best compatibility)
- **ALPN**: `h2,http/1.1` (default: HTTP/2 and HTTP/1.1)

#### Access Method

Choose how the panel should manage the V2Ray server:

- **API**: Uses direct API calls (if V2Ray API is enabled)
- **SSH**: Uses SSH to run `v2ray-cli` commands ⬅️ **Recommended for most setups**

##### SSH Settings (if using SSH method)
- **SSH Host**: Your server IP or hostname
- **SSH Port**: `22`
- **SSH Username**: `root` or your sudo user
- **SSH Password**: *(optional if using private key)*
- **SSH Private Key**: *(optional if using password)*

> **Note**: SSH key is now optional. You can save the server first and update credentials later.

---

## Server-Side Configuration

### 1. Server Requirements

Your V2Ray/Xray server must be configured for:
- **Port 443** listening with TLS
- **WebSocket transport** on path `/vpn`
- **Valid TLS certificate** (from Let's Encrypt or Cloudflare Origin Certificate)
- **Domain pointed to Cloudflare** (orange cloud enabled)

### 2. Cloudflare Settings

1. **DNS Settings**:
   - Add `A` or `CNAME` record pointing to your server IP
   - **Enable proxy** (orange cloud icon) ⬅️ **IMPORTANT**

2. **SSL/TLS Settings**:
   - Mode: **Full** or **Full (strict)**
   - Min TLS Version: **1.2**

3. **Network Settings**:
   - ✅ Enable **WebSockets**
   - ✅ Enable **HTTP/2**

### 3. Example Xray Server Config

```json
{
  "inbounds": [
    {
      "port": 443,
      "protocol": "vmess",
      "settings": {
        "clients": []
      },
      "streamSettings": {
        "network": "ws",
        "security": "tls",
        "wsSettings": {
          "path": "/vpn"
        },
        "tlsSettings": {
          "certificates": [
            {
              "certificateFile": "/etc/xray/cert.pem",
              "keyFile": "/etc/xray/key.pem"
            }
          ],
          "alpn": ["h2", "http/1.1"]
        }
      }
    }
  ],
  "outbounds": [
    {
      "protocol": "freedom"
    }
  ]
}
```

### 4. Install TLS Certificate

#### Option A: Let's Encrypt (Certbot)
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d mingalarpar.news

# Link certificates
sudo ln -sf /etc/letsencrypt/live/mingalarpar.news/fullchain.pem /etc/xray/cert.pem
sudo ln -sf /etc/letsencrypt/live/mingalarpar.news/privkey.pem /etc/xray/key.pem

sudo systemctl restart xray
```

#### Option B: Cloudflare Origin Certificate
1. Go to Cloudflare Dashboard → SSL/TLS → Origin Server
2. Create Certificate (choose 15 years validity)
3. Save certificate and key to `/etc/xray/cert.pem` and `/etc/xray/key.pem`
4. Restart Xray: `sudo systemctl restart xray`

---

## Device Creation

Once the server is added, create devices as usual:

1. **Devices** → **Add Device**
2. Select your V2Ray server
3. Choose a plan
4. Assign to user

The panel will now generate proper **VMess URLs** with:
- ✅ `net: ws` (WebSocket)
- ✅ `tls: tls`
- ✅ `path: /vpn`
- ✅ `sni: mingalarpar.news`
- ✅ `alpn: h2,http/1.1`
- ✅ `fp: chrome`

---

## Troubleshooting

### Issue: Generated config still shows `net: tcp`

**Solution**: 
- Edit the V2Ray server in panel
- Enable **"Enable TLS"** checkbox
- Change **Network Type** to **"WebSocket (CF proxy)"**
- Click **Update Server**
- Create a new device to get the updated config

### Issue: Connection fails with TLS error

**Cause**: Certificate mismatch or Cloudflare SSL mode incorrect

**Solution**:
1. Verify Cloudflare SSL/TLS mode is **Full** or **Full (strict)**
2. Check certificate is valid: `openssl s_client -connect mingalarpar.news:443 -servername mingalarpar.news`
3. Ensure SNI matches your domain exactly
4. Try regenerating origin certificate in Cloudflare

### Issue: WebSocket connection refused

**Cause**: Cloudflare WebSocket not enabled or path mismatch

**Solution**:
1. Enable WebSockets in Cloudflare dashboard (Network settings)
2. Verify `wsPath` in panel matches server config (default: `/vpn`)
3. Check Xray/V2Ray logs: `sudo journalctl -u xray -f`

### Issue: SSH key error when saving server

**Cause**: Invalid private key format

**Solution**:
- Server will save with a warning if key format is unsupported
- Update SSH credentials later in server edit form
- Or convert key to OpenSSH format: `ssh-keygen -p -m PEM -f ~/.ssh/id_rsa`

---

## Testing Connection

### From Client App (V2rayNG, v2rayN, etc.)

1. Import the generated VMess URL
2. Verify settings show:
   - Network: `ws`
   - TLS: `tls`
   - Path: `/vpn`
   - SNI: your domain
3. Connect and test

### From Server

Check Xray is listening on 443:
```bash
sudo ss -tulpn | grep :443
```

Check recent connections:
```bash
sudo journalctl -u xray -n 50
```

### From Panel

Check device stats after using VPN:
- Go to **Devices** page
- Stats should show bytes used (may take 1-2 minutes to update)

---

## Benefits of Cloudflare Proxy

✅ **Hide origin IP**: Cloudflare CDN masks your server's real IP  
✅ **DDoS protection**: Cloudflare's network protects against attacks  
✅ **Censorship resistance**: HTTPS traffic appears as normal web browsing  
✅ **Better performance**: CDN caching and edge network optimization  
✅ **Free SSL**: No need to manage Let's Encrypt renewals  

---

## Related Documentation

- [V2RAY_SERVER_COMPLETE_SETUP.md](./V2RAY_SERVER_COMPLETE_SETUP.md) - Complete V2Ray/Xray installation guide
- [API_ENDPOINT_REFERENCE.md](./API_ENDPOINT_REFERENCE.md) - API documentation

---

## Summary

The key to making V2Ray work with Cloudflare proxy is:

1. **Server-side**: Configure Xray with WebSocket + TLS on port 443
2. **Cloudflare**: Enable proxy (orange cloud) and WebSocket support
3. **Panel**: Enable TLS and select WebSocket network type when adding server
4. **Clients**: Will automatically receive proper VMess configs with all required fields

The panel now generates proper VMess client configurations automatically when:
- ✅ `v2rayUseTls` is enabled
- ✅ `v2rayNetwork` is set to `ws`
- ✅ Server has proper CF proxy settings configured

No manual config editing needed! 🎉
