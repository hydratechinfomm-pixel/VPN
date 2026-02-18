# Fix V2Ray Per-User Stats Tracking

## Problem
V2Ray device statistics were always showing 0 because clients were added without the `level` field, which is required for per-user stats tracking.

## Root Cause
The xray config has this policy:
```json
"policy": {
  "levels": {
    "0": {
      "statsUserUplink": true,
      "statsUserDownlink": true
    }
  }
}
```

But clients were being added without `"level": 0`:
```json
{"id":"uuid","alterId":0,"email":"device-name"}  ❌ No level field
```

They should be:
```json
{"id":"uuid","alterId":0,"email":"device-name","level":0}  ✅ With level field
```

## Solution Summary

**Panel Code Fixed:**
- ✅ [server/services/V2rayService.js](server/services/V2rayService.js#L327) - `ensureUserInConfig()` now adds `level: 0`
- ✅ [server/services/V2rayService.js](server/services/V2rayService.js#L453) - Improved logging in `getUserStats()`
- ✅ [V2RAY_SERVER_COMPLETE_SETUP.md](V2RAY_SERVER_COMPLETE_SETUP.md#L153) - v2ray-cli script updated (2 instances)

**Server-Side Actions Needed:**
1. Update v2ray-cli script on your V2Ray server
2. Fix existing clients to add the level field
3. Test stats collection

---

## Step 1: Update v2ray-cli Script on V2Ray Server

SSH to your V2Ray server and update the script:

```bash
# SSH to V2Ray server
ssh root@YOUR_V2RAY_SERVER_IP

# Backup current script
sudo cp /usr/local/bin/v2ray-cli /usr/local/bin/v2ray-cli.backup

# Edit the script
sudo nano /usr/local/bin/v2ray-cli
```

Find the line (around line 153):
```bash
JQ_FILTER='(.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients) |= . + [{"id":"'$UUID'","alterId":0,"email":"'$NAME'"}]'
```

Change it to:
```bash
JQ_FILTER='(.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients) |= . + [{"id":"'$UUID'","alterId":0,"email":"'$NAME'","level":0}]'
```

**Or just replace the entire v2ray-cli script** with the updated version from [V2RAY_SERVER_COMPLETE_SETUP.md](V2RAY_SERVER_COMPLETE_SETUP.md#L63-L263).

Save and exit (`Ctrl+X`, `Y`, `Enter`).

---

## Step 2: Fix Existing Clients in Xray Config

Run this script on your V2Ray server to add `"level": 0` to all existing clients:

```bash
#!/bin/bash
# fix-xray-clients-level.sh
# Adds "level": 0 to all VMess clients for stats tracking

XRAY_CONFIG="/usr/local/etc/xray/config.json"

# Check if config exists
if [ ! -f "$XRAY_CONFIG" ]; then
    echo "Error: Xray config not found at $XRAY_CONFIG"
    exit 1
fi

# Backup original config
sudo cp "$XRAY_CONFIG" "${XRAY_CONFIG}.backup-$(date +%Y%m%d-%H%M%S)"
echo "Backup created: ${XRAY_CONFIG}.backup-$(date +%Y%m%d-%H%M%S)"

# Add level:0 to all clients that don't have it
TMP_FILE="/tmp/xray-config-fix-$$.json"

sudo jq '
  (.inbounds[] | select(.protocol=="vmess" or .tag=="vmess-inbound") | .settings.clients[]?) |=
  if has("level") then . else . + {"level": 0} end
' "$XRAY_CONFIG" > "$TMP_FILE"

if [ $? -eq 0 ]; then
    # Validate the new config
    if xray -test -config="$TMP_FILE" &>/dev/null; then
        echo "✓ New config is valid"
        sudo mv "$TMP_FILE" "$XRAY_CONFIG"
        sudo chmod 644 "$XRAY_CONFIG"
        
        # Restart xray
        echo "Restarting xray..."
        sudo systemctl restart xray
        
        if [ $? -eq 0 ]; then
            echo "✓ Xray restarted successfully"
            echo ""
            echo "Clients updated. Checking stats..."
            sleep 2
            
            # Test stats query
            xray api statsquery -pattern "" | head -20
        else
            echo "✗ Failed to restart xray"
            echo "Restoring backup..."
            sudo cp "${XRAY_CONFIG}.backup-$(date +%Y%m%d-*)" "$XRAY_CONFIG"
            sudo systemctl restart xray
            exit 1
        fi
    else
        echo "✗ New config is invalid, keeping original"
        rm -f "$TMP_FILE"
        exit 1
    fi
else
    echo "✗ jq command failed"
    rm -f "$TMP_FILE"
    exit 1
fi

echo ""
echo "Done! All clients now have level:0 for stats tracking."
```

**To run:**
```bash
# Create the script
cat > fix-xray-clients-level.sh << 'EOF'
[paste the script above]
EOF

# Make executable
chmod +x fix-xray-clients-level.sh

# Run it
sudo ./fix-xray-clients-level.sh
```

---

## Step 3: Verify Stats Are Working

### Test on V2Ray Server:

```bash
# Query all stats
xray api statsquery -pattern ""

# Should now show user stats like:
# {
#   "stat": [
#     {"name": "inbound>>>vmess-inbound>>>traffic>>>uplink", "value": 1686209},
#     {"name": "user>>>YOUR-UUID>>>traffic>>>uplink", "value": 12345},  ← NEW!
#     {"name": "user>>>YOUR-UUID>>>traffic>>>downlink", "value": 67890},  ← NEW!
#     ...
#   ]
# }

# Test specific user
xray api statsquery -pattern "user>>>YOUR-UUID>>>traffic"
```

### Test from Panel:

1. **Restart your panel server** (to load the updated code):
   ```bash
   # If using npm run dev
   Ctrl+C and restart

   # If using PM2
   pm2 restart vpn-panel
   ```

2. **Open browser console** and go to Devices page

3. **Watch server logs** for detailed stats queries:
   ```bash
   # You should see logs like:
   [V2rayService.getUserStats] Fetching stats for user: 6b6d6927-6379-4050-b7d9-064fde9aff27
   [V2rayService.getUserStats] Using SSH method
   [V2rayService.getUserStats] Total stats entries: 15
   [V2rayService.getUserStats] Found matching stat: user>>>6b6d6927-...>>>traffic>>>uplink = 12345
   [V2rayService.getUserStats] Final stats: uplink=12345, downlink=67890, total=80235
   ```

4. **Manually refresh stats**:
   - Click the refresh icon on any V2Ray device
   - Or call the bulk-stats endpoint: `POST /api/devices/bulk-stats`

5. **Verify device list shows usage** instead of 0 bytes

---

## Alternative: Recreate Devices (If Fix Script Fails)

If you prefer, you can just delete and recreate V2Ray devices from the panel:

1. Export device info (username, plan, etc.)
2. Delete V2Ray devices from panel (this removes them from server)
3. Create new devices with same settings
4. New devices will be created with `level: 0` automatically

---

## Troubleshooting

### Stats still showing 0:

1. **Check xray config has level field:**
   ```bash
   sudo jq '.inbounds[] | select(.protocol=="vmess") | .settings.clients' /usr/local/etc/xray/config.json
   
   # Each client should show:
   # {
   #   "id": "uuid",
   #   "alterId": 0,
   #   "email": "device-name",
   #   "level": 0  ← This must be present
   # }
   ```

2. **Verify policy is configured:**
   ```bash
   sudo jq '.policy.levels["0"]' /usr/local/etc/xray/config.json
   
   # Should show:
   # {
   #   "statsUserUplink": true,
   #   "statsUserDownlink": true
   # }
   ```

3. **Check xray is tracking stats:**
   ```bash
   xray api statsquery -pattern "user>>>" | grep -A 2 "user>>>"
   
   # Should show per-user entries, not just inbound/outbound
   ```

4. **Generate some traffic:**
   - Connect with a V2Ray client
   - Browse the internet for a minute
   - Query stats again - values should increase

5. **Check panel logs:**
   - Detailed logs now show exact SSH commands and responses
   - Look for error messages or "no matching stats found"

### Xray won't start after config change:

```bash
# Check config syntax
xray -test -config /usr/local/etc/xray/config.json

# Check logs
sudo journalctl -u xray -n 50

# Restore backup if needed
sudo cp /usr/local/etc/xray/config.json.backup-* /usr/local/etc/xray/config.json
sudo systemctl restart xray
```

---

## Summary

✅ **Panel code updated** - New devices will have `level: 0` automatically  
✅ **Detailed logging added** - Easy to diagnose stats issues  
✅ **v2ray-cli script fixed** - Server-side user creation includes level field  
⚠️ **Existing devices need** - Either manual config fix or recreation

After completing the steps above, V2Ray device statistics should work correctly!

**Last Updated:** February 18, 2026
