# WireGuard Configuration Troubleshooting

## Common Issues and Solutions

### Issue: Device Config Not Working After QR Scan

#### Problem
The generated config file shows `Address = 10.0.0.1/32` but the connection doesn't work.

#### Solution
This happens when the device is assigned the server's IP address. The fix has been applied to start assigning IPs from `10.0.0.2` onwards.

**Steps to fix existing devices:**

1. **Delete the problematic device** from the control panel
2. **Create a new device** - it will now get a proper client IP (10.0.0.2, 10.0.0.3, etc.)
3. **Download the new config** or scan the new QR code
4. **Test the connection**

#### Verify Server Configuration

Make sure your WireGuard server config (`/etc/wireguard/wg0.conf`) has:

```ini
[Interface]
PrivateKey = YOUR_SERVER_PRIVATE_KEY
Address = 10.0.0.1/24    # Server MUST use .1
ListenPort = 51820
```

**Important:** The server MUST use `10.0.0.1` as its address. Client devices will use `10.0.0.2`, `10.0.0.3`, etc.

---

### Issue: Connection Timeout

#### Possible Causes:
1. **Firewall blocking port 51820**
   ```bash
   sudo ufw allow 51820/udp
   sudo ufw reload
   ```

2. **WireGuard not running**
   ```bash
   sudo systemctl status wg-quick@wg0
   sudo systemctl start wg-quick@wg0
   ```

3. **Wrong endpoint IP**
   - Check the server's public IP address
   - Verify it matches the endpoint in the config

4. **NAT not configured**
   - Ensure PostUp/PostDown rules are in server config
   - Check iptables rules

---

### Issue: No Internet Access Through VPN

#### Solution:
1. **Check NAT rules** in server config:
   ```ini
   PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
   PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
   ```

2. **Replace `eth0`** with your actual network interface:
   ```bash
   ip addr show
   # Find your main interface (usually eth0, ens3, enp0s3, etc.)
   ```

3. **Enable IP forwarding:**
   ```bash
   echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
   sudo sysctl -p
   ```

---

### Issue: Peer Not Showing in WireGuard

#### Check:
1. **Verify peer was added:**
   ```bash
   sudo wg show wg0
   ```

2. **Check if peer exists in database:**
   - Go to Devices page in control panel
   - Verify device shows correct public key

3. **Manually add peer if missing:**
   ```bash
   sudo wg set wg0 peer DEVICE_PUBLIC_KEY allowed-ips 10.0.0.X/32
   ```

---

### Issue: QR Code Not Scanning

#### Solutions:
1. **Increase QR code size** - The QR might be too small
2. **Check QR code quality** - Ensure good lighting
3. **Try downloading config file** instead
4. **Verify config format** - Check for line breaks or encoding issues

---

### Issue: "Handshake did not complete"

#### Causes:
1. **Firewall blocking** - Check UDP port 51820
2. **Wrong endpoint** - Verify server IP/domain
3. **Server not running** - Check WireGuard service
4. **Network issues** - Test connectivity to server

#### Debug:
```bash
# On server
sudo wg show wg0 dump

# Check for handshake times
# If all show 0, peers aren't connecting
```

---

### Issue: Multiple Devices Can't Connect

#### Check:
1. **IP conflicts** - Each device needs unique IP
2. **Server capacity** - Check how many peers are configured
3. **Resource limits** - Server might be overloaded

---

### Verification Checklist

After creating a device, verify:

- [ ] Device got IP starting from 10.0.0.2 (NOT 10.0.0.1)
- [ ] Config file has correct server public key
- [ ] Config file has correct endpoint IP:Port
- [ ] Server WireGuard is running (`sudo wg show`)
- [ ] Peer appears in server (`sudo wg show wg0`)
- [ ] Firewall allows port 51820/udp
- [ ] IP forwarding is enabled
- [ ] NAT rules are configured

---

### Testing Connection

1. **On server:**
   ```bash
   sudo wg show wg0
   # Should show peer with handshake time
   ```

2. **On client (phone/device):**
   - Connect via WireGuard app
   - Check connection status
   - Test internet access

3. **Check logs:**
   ```bash
   sudo journalctl -u wg-quick@wg0 -f
   ```

---

### Quick Fix Commands

```bash
# Restart WireGuard
sudo systemctl restart wg-quick@wg0

# Check status
sudo wg show wg0

# View all peers
sudo wg show wg0 dump

# Remove a peer (if needed)
sudo wg set wg0 peer PEER_PUBLIC_KEY remove

# Reload config
sudo wg-quick down wg0
sudo wg-quick up wg0
```
