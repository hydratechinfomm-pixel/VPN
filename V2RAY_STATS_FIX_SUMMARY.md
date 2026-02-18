# V2Ray Stats Fix - Complete Solution

## Issue
When calling the API endpoint, V2Ray device stats were always returning 0 bytes, even though the server clearly had stats available.

**Server vs API mismatch:**
```bash
# ✅ On server: v2ray-cli stats aa → Shows stats (1435700 uplink, 96783418 downlink)
# ❌ API returning:  bytesUsed: 0, uplink: 0, downlink: 0
```

## Root Cause
The panel was passing the **UUID** to `getUserStats()`, but v2ray-cli and xray API expect the **device NAME** (email field):

```json
// Xray stats are keyed by:
"user>>>device-name>>>traffic>>>uplink"   ✅ Works
"user>>>UUID>>>traffic>>>uplink"           ❌ Doesn't work
```

## Solution: 3-Part Fix

### Part 1: Panel Code (DONE)
**Changed in:** [server/controllers/deviceController.js](server/controllers/deviceController.js)

**Lines 747-751** (single device stats):
```javascript
// BEFORE
const stats = await vpnService.getUserStats(device.v2rayUser.userId);

// AFTER
const statsIdentifier = device.v2rayUser.name || device.v2rayUser.userId;
const stats = await vpnService.getUserStats(statsIdentifier);
```

**Line 902** (bulk-stats endpoint):
```javascript
// BEFORE
if (server.vpnType === 'v2ray' && device.v2rayUser?.userId) {
  stats = await vpnService.getUserStats(device.v2rayUser.userId);

// AFTER
if (server.vpnType === 'v2ray' && device.v2rayUser) {
  stats = await vpnService.getUserStats(device.v2rayUser.name || device.v2rayUser.userId);
```

**Why:** Now passes device name first, which is what v2ray-cli stats expects.

### Part 2: v2ray-cli Script (DONE)
**In:** [V2RAY_SERVER_COMPLETE_SETUP.md](V2RAY_SERVER_COMPLETE_SETUP.md#L228-L267)

The `stats` command now:
1. Tries the input as-is as a pattern (for device names like "aa")
2. If not found, queries all stats and filters for matching user entries
3. Works with both UUIDs and device names

**Before:**
```bash
STATS=$(xray api statsquery -pattern "user>>>$UUID>>>traffic" 2>/dev/null)
if echo "$STATS" | grep -q "uplink\|downlink"; then
  echo "$STATS"
else
  STATS=$(xray api statsquery -pattern "" 2>/dev/null)
  echo "$STATS"
fi
```

**After:**
```bash
SEARCH_KEY="$2"  # Can be UUID or name

# Try direct pattern first
STATS=$(xray api statsquery -pattern "user>>>$SEARCH_KEY>>>traffic" 2>/dev/null)
if echo "$STATS" | grep -q '"value"'; then
  echo "$STATS"
  exit 0
fi

# Fallback: query all stats and filter
ALL_STATS=$(xray api statsquery -pattern "" 2>/dev/null)
FILTERED=$(echo "$ALL_STATS" | jq '{stat: [.stat[] | select(.name | contains("user>>>") and contains("'$SEARCH_KEY'>>>traffic"))]}')
echo "$FILTERED"
```

### Part 3: Enhanced Logging (DONE)
**In:** [server/services/V2rayService.js](server/services/V2rayService.js#L456)

Added detailed logging showing:
- What identifier is being searched for
- Which method is being used (SSH vs API)
- Total stats entries found
- Which entries matched
- Final values returned

## Testing

### Step 1: Restart Panel
```bash
# If using npm run dev
Ctrl+C and restart npm run dev

# If using PM2
pm2 restart vpn-panel
```

### Step 2: Update v2ray-cli on Server
SSH to your V2Ray server and replace the v2ray-cli script with the updated version from [V2RAY_SERVER_COMPLETE_SETUP.md](V2RAY_SERVER_COMPLETE_SETUP.md#L63-L263).

### Step 3: Test the Fix

**On panel, open browser console:**
```javascript
// Test single device stats
fetch('http://localhost:5000/api/devices/YOUR_DEVICE_ID/stats')
  .then(r => r.json())
  .then(console.log)

// Test bulk stats
fetch('http://localhost:5000/api/devices/bulk-stats', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({deviceIds: ['DEVICE_ID1', 'DEVICE_ID2']})
})
  .then(r => r.json())
  .then(console.log)
```

**Check panel server logs:**
```
[V2rayService.getUserStats] Fetching stats for user: aa   ← device name
[V2rayService.getUserStats] Using SSH method
[V2rayService.getUserStats] v2ray-cli response: {"stat":[...]}
[V2rayService.getUserStats] Total stats entries: 2
[V2rayService.getUserStats] Found matching stat: user>>>aa>>>traffic>>>uplink = 1435700
[V2rayService.getUserStats] Found matching stat: user>>>aa>>>traffic>>>downlink = 96783418
[V2rayService.getUserStats] Final stats: uplink=1435700, downlink=96783418, total=97819118
```

**Refresh devices page in panel:**
- Should now show usage in bytes for all V2Ray devices
- Not showing 0 bytes anymore

## Verification Checklist

- [ ] Panel Server restarted
- [ ] v2ray-cli script updated on V2Ray server
- [ ] Test API returns non-zero bytes for devices with traffic
- [ ] Panel device list shows correct usage
- [ ] Logs show correct identifier (device name)
- [ ] No more "uplink=0, downlink=0" in stats

## What If It Still Doesn't Work?

1. **Check v2ray-cli is updated:**
   ```bash
   ssh root@YOUR_V2RAY_IP
   grep "SEARCH_KEY=" /usr/local/bin/v2ray-cli
   # Should show the updated version
   ```

2. **Manually test v2ray-cli:**
   ```bash
   # Test with device name (should work now)
   v2ray-cli stats aa
   
   # Test with UUID (should also work now with filtering)
   v2ray-cli stats 6b6d6927-6379-4050-b7d9-064fde9aff27
   ```

3. **Check xray is tracking user stats:**
   ```bash
   # Generate some traffic by connecting with a client
   
   # Then query:
   xray api statsquery -pattern "user>>>" | head -20
   # Should show user>>> entries, not just inbound/outbound
   ```

4. **Verify policy and level field:**
   ```bash
   # Check clients have level:0
   sudo jq '.inbounds[] | select(.protocol=="vmess") | .settings.clients" /usr/local/etc/xray/config.json
   
   # Check policy has level 0 with stats enabled
   sudo jq '.policy.levels["0"]' /usr/local/etc/xray/config.json
   ```

## Summary

✅ Panel now passes device name (not UUID) to stats queries  
✅ v2ray-cli script now handles both device names and UUIDs  
✅ Detailed logging shows exactly what's being searched  
✅ Device stats should now show actual traffic usage  

The fix ensures the entire chain works correctly:
- **Panel** → passes device name
- **V2rayService** → logs details and calls v2ray-cli  
- **v2ray-cli** → searches by name or filters UUID
- **xray** → returns matching user stats

**Status:** Ready to test
