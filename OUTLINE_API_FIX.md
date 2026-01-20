# Outline API v1.12.3 Integration - Bug Fix Report

## Issue Summary
The Outline VPN integration was failing with HTTP 404 errors when attempting to connect to real Outline servers. The error message was:
```
Cannot connect to outline server. Please verify the connection details.
```

## Root Cause
The OutlineService was using the **wrong API endpoint format**:
- ❌ **Incorrect**: `/api/{endpoint}` with `X-API-User` header
- ✅ **Correct**: `/{adminAccessKey}/{endpoint}` without auth header

The actual Outline v1.12.3 API uses the admin access key as part of the URL path, not as a request header.

## Changes Made

### 1. **OutlineService.js - API Endpoint Format** (Line 27-48)
Changed the `makeRequest()` method to use correct endpoint format:

**Before:**
```javascript
path: `/api/${path}`,
headers: {
  'X-API-User': this.adminAccessKey,
}
```

**After:**
```javascript
path: `/${this.adminAccessKey}/${path}`,
headers: {
  'Content-Type': 'application/json',
}
```

### 2. **OutlineService.js - Endpoint Mappings** 
Fixed all endpoint paths:

| Endpoint | Purpose | Format |
|----------|---------|--------|
| `server` | Get server info | `/{adminKey}/server` |
| `access-keys` | List/manage users | `/{adminKey}/access-keys` |
| `metrics/transfer` | Get data usage | `/{adminKey}/metrics/transfer` |

### 3. **OutlineService.js - Data Model Fixes**
Updated response parsing for Outline v1.12.3 API:

- **Server ID field**: `id` → `serverId`
- **Access Keys endpoint**: Returns `{ accessKeys: [...] }` format (not in `/server` response)
- **Metrics format**: Returns `{ bytesTransferredByUserId: {...} }` object

### 4. **Updated Methods**:

#### `getServerStats()` 
- Now fetches from separate `/access-keys` endpoint
- Uses `metrics/transfer` for accurate data usage
- Correctly counts total users and bandwidth

#### `getUserStats(accessKeyId)`
- Fetches access keys from `/access-keys` endpoint
- Retrieves metrics from `/metrics/transfer` by user ID
- Returns accurate data usage per user

#### `getUserAccessConfig(accessKeyId)`
- Updated to fetch from `/access-keys` endpoint
- Returns correct `accessUrl` for client connection

#### `initialize()`
- Fixed field name: `serverId` (not `id`)

## Testing Results

Successfully tested with real Outline server:
- **Server**: `170.168.61.164:13069`
- **Admin Key**: `qjv7AuyJ36z1oqiuQ6BivQ`

✅ **Test Results:**
```javascript
Server Stats:
{
  serverId: '0e321d0a-5060-4410-b5ac-61b10aab86a4',
  serverVersion: '1.12.3',
  totalUsers: 3,
  totalDataTransferred: 26178625362 bytes,
  portForNewAccessKeys: 42061,
  uptime: 100,
  isHealthy: true
}

User 0 Stats:
{
  accessKeyId: '0',
  name: '',
  bytesUsed: 20117183466 bytes,
  dataLimit: 20000000000 bytes
}

User 2 Stats:
{
  accessKeyId: '2',
  name: 'San Gyi',
  bytesUsed: 2676086633 bytes,
  dataLimit: 20000000000 bytes
}
```

## JSON Config Import Feature
The ServerForm component includes a JSON import feature for easy Outline server setup:

**Supported JSON Format:**
```json
{
  "apiUrl": "https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ",
  "certSha256": "475B7A040FB407CB7865C81C073CAEBF0707C38581A236F0B5F8D0F28AFF350C"
}
```

**Auto-extracts:**
- Host: `170.168.61.164`
- Port: `13069`
- Admin Key: `qjv7AuyJ36z1oqiuQ6BivQ`
- Certificate SHA256: (optional)

## Outline API v1.12.3 Endpoints Reference

All endpoints use format: `https://{host}:{port}/{adminKey}/{endpoint}`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `server` | Get server information |
| GET | `access-keys` | List all access keys |
| POST | `access-keys` | Create new access key |
| DELETE | `access-keys/{id}` | Delete access key |
| PUT | `access-keys/{id}` | Update access key |
| GET | `metrics/transfer` | Get data transfer metrics |
| GET | `metrics/enabled` | Check if metrics enabled |

## Build Status
✅ Build successful - no errors
✅ All tests passing
✅ Ready for production deployment

## Deployment Notes
- Supports custom ports (tested with 13069)
- Works with both self-signed and valid certificates (rejectUnauthorized: false)
- 10-second request timeout for reliability
- HTTP/HTTPS auto-detection for localhost vs remote servers
