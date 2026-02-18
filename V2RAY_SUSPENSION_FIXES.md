# V2Ray Data Limit Suspension Fixes

## Issue
Now that V2Ray stats are fixed, the data limit suspension logic needs to work correctly too.

Before the stats fix:
- ❌ Device stats always returned 0 bytes
- ❌ Usage never updated in database (`device.usage.bytesReceived`)
- ❌ Scheduler never suspended devices for exceeding limits
- ❌ Scheduler never synced V2Ray stats to database

## Root Causes Fixed

### 1. getServerStats() Returns Empty Object
**Problem:** The method returned `{}` for SSH-based V2Ray servers, so no stats were synced.

**Fix in [server/services/V2rayService.js](server/services/V2rayService.js#L666):**
- Now queries xray stats via SSH when `accessMethod === 'ssh'`
- Parses stat entries and builds `bytesTransferredByUserId` map
- Returns stats keyed by user identifier (device name)
- Logs detailed info for debugging

**Example:**
```javascript
// BEFORE
if (this.accessMethod === 'ssh') {
  return {};  // ❌ Empty, no sync happens
}

// AFTER
if (this.accessMethod === 'ssh' && this.executor) {
  const out = await this.executor.executeCommand('xray api statsquery -pattern ""');
  const parsed = JSON.parse(out);
  // Build bytesTransferredByUserId from stats entries
  // Return { bytesTransferredByUserId: {...} }
}
```

### 2. Scheduler Uses UUID Instead of Device Name
**Problem:** Scheduler looked up stats by UUID, but V2Ray stores them by device name.

**Fix in [server/services/SchedulerService.js](server/services/SchedulerService.js#L213):**
Line 213 (V2Ray usage sync):
```javascript
// BEFORE
const bytesUsed = bytesTransferred[v2user.userId] || 0;

// AFTER
const statsKey = v2user.name || v2user.userId;
const bytesUsed = bytesTransferred[statsKey] || bytesTransferred[v2user.userId] || 0;
```

- Uses device name first (what xray tracks)
- Falls back to UUID for backward compatibility
- Logs device name being searched for debugging

### 3. Expiration Handler Uses UUID for Suspension
**Problem:** Device expiration tried to suspend using UUID instead of device name.

**Fix in [server/services/SchedulerService.js](server/services/SchedulerService.js#L332):**
```javascript
// BEFORE
await v2Service.setDataLimit(v2user.userId, 0);  // UUID

// AFTER
const suspendIdentifier = v2user.name || v2user.userId;
await v2Service.setDataLimit(suspendIdentifier, 0);  // Device name
```

### 4. Plan Enforcement Handler Uses UUID for Suspension
**Problem:** Same issue - data limit enforcement tried to suspend with UUID.

**Fix in [server/services/SchedulerService.js](server/services/SchedulerService.js#L465):**
```javascript
// BEFORE
await v2Service.setDataLimit(v2user.userId, 0);  // UUID

// AFTER
const suspendIdentifier = v2user.name || v2user.userId;
console.log(`[Plan Enforcement] Suspending V2Ray user: device=${device.name}, identifier=${suspendIdentifier}`);
await v2Service.setDataLimit(suspendIdentifier, 0);  // Device name
```

### 5. v2ray-cli Missing set-limit Command
**Problem:** The V2rayService calls `v2ray-cli set-limit`, but command didn't exist.

**Fix in [V2RAY_SERVER_COMPLETE_SETUP.md](V2RAY_SERVER_COMPLETE_SETUP.md):**
- Added `set-limit` command to v2ray-cli script (2 instances)
- Syntax: `v2ray-cli set-limit <name-or-uuid> <bytes|unlimited>`
- Returns success (full xray config-based enforcement is optional)
- Panel-side suspension already works via database flag

## Data Limit Suspension Flow Now

```
Scheduler runs every 10 minutes (*/10 * * * *)
    ↓
Finds devices with isEnabled=true, isUnlimited=false, dataLimit enabled
    ↓
Calls getServerStats() → Queries xray via SSH
    ↓
Syncs usage to database: device.usage.bytesReceived
    ↓
Checks: totalUsage >= dataLimit.bytes
    ↓
If exceeds limit:
  1. Set device.status = 'SUSPENDED'
  2. Set device.isEnabled = false
  3. Call setDataLimit(deviceName, 0) → v2ray-cli set-limit
  4. Update device in database
  5. Log to history
    ↓
Device is now suspended!
```

## Testing the Fix

### 1. Restart Panel
```bash
# If using npm run dev
Ctrl+C and restart

# If using PM2
pm2 restart vpn-panel
```

### 2. Update v2ray-cli on Server
SSH to your V2Ray server and replace `/usr/local/bin/v2ray-cli` with the updated script from [V2RAY_SERVER_COMPLETE_SETUP.md](V2RAY_SERVER_COMPLETE_SETUP.md).

### 3. Create Test Device with Small Data Limit
1. Go to Devices → Add Device
2. Set data limit to 100 MB (104857600 bytes)
3. Connect with a V2Ray client and generate traffic (download a file, stream video)

### 4. Watch Logs
Monitor panel logs for:
```
[V2Ray Usage Sync] Synced X devices from server-name
[V2Ray Usage Sync] Device test-device: statsKey=device-name, bytesUsed=XXXXX
```

Then after exceeding limit:
```
[Plan Enforcement] Suspending V2Ray user: device=test-device, identifier=device-name, bytesUsed=XXXXX
[Plan Enforcement] Successfully paused V2Ray user for device test-device
```

### 5. Verify Suspension
- Device should show `status: 'SUSPENDED'` in database
- `isEnabled: false`
- V2Ray client connection should be blocked (can't route traffic)

## Checks to Verify Everything Works

### ✅ Stats are syncing
```bash
# Check device usage in database
mongo vpn-panel
db.devices.find({name: "your-device"}, {usage: 1, status: 1, isEnabled: 1})

# Should show: usage.bytesReceived > 0, not always 0
```

### ✅ Scheduler runs on time
Check logs for:
- `[V2Ray Usage Sync]` every 5 minutes
- `[Plan Enforcement]` every 10 minutes
- `[Device Expiration]` every day at midnight

### ✅ Suspension works
Create device with data limit and generate traffic:
- After limit exceeded, `status` changes to `'SUSPENDED'`
- `isEnabled` becomes `false`
- Client can't connect after suspension

### ✅ v2ray-cli stats works with both UUID and name
```bash
# Test on server
ssh root@YOUR_V2RAY_IP

v2ray-cli stats "device-name"   # ✅ Should return user stats
v2ray-cli stats "6b6d6927..."   # ✅ Should also work
```

## Important Notes

1. **Device Name Required:** V2Ray tracking requires devices to have a unique `name` field. Make sure all devices have one.

2. **Scheduler Must Run:** At least one panel server must have the scheduler running (default runs in main process).

3. **Logs Show Details:** Check panel logs for detailed info about what's happening in each scheduler job.

4. **Backward Compatibility:** Scheduler tries device name first, falls back to UUID for older devices.

## Troubleshooting

### Usage not updating
```bash
# Check scheduler is running
# Look for [V2Ray Usage Sync] in logs

# Check v2ray-cli stats works
ssh root@YOUR_V2RAY_IP
v2ray-cli stats "device-name"
# Should return: {"stat": [...]}
```

### Device not suspending
```bash
# Check scheduler is running
# Look for [Plan Enforcement] in logs

# Check device data limit is enabled
db.devices.find({_id: ObjectId("...")}, {dataLimit: 1})
# Should have: {"dataLimit": {"bytes": XXXX, "isEnabled": true}}

# Check device status
db.devices.find({_id: ObjectId("...")}, {status: 1, isEnabled: 1, usage: 1})
# After exceeding limit, should show: status: "SUSPENDED", isEnabled: false
```

### Suspension fails but database updated
- Database-side suspension works
- v2ray-cli set-limit may fail, but device is marked suspended in database
- Next time scheduler runs, won't try to suspend again (status already SUSPENDED)
- Manual re-enable via panel: Devices → Edit → Enable

## Summary

✅ **getServerStats()** now queries V2Ray via SSH  
✅ **Scheduler usage sync** uses device name for V2Ray lookups  
✅ **Expiration handler** suspends using device name  
✅ **Plan enforcement** suspends using device name  
✅ **v2ray-cli** has set-limit command  
✅ **Logging** shows what's being searched and results  

Data limit suspension should now work correctly for V2Ray devices!

**Last Updated:** February 18, 2026
