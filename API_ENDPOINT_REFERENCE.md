# API Endpoint Format Reference

## Outline v1.12.3 API - Correct Format

### Base URL Format
```
https://{host}:{port}/{adminAccessKey}/{endpoint}
```

### Examples

#### Your Real Server
```
Host: 170.168.61.164
Port: 13069
Admin Key: qjv7AuyJ36z1oqiuQ6BivQ

Complete URLs:
- Server Info: https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ/server
- List Users: https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ/access-keys
- Metrics: https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ/metrics/transfer
```

## BEFORE (❌ Incorrect)
```javascript
// Old code that was failing:
path: `/api/${path}`,
headers: {
  'X-API-User': this.adminAccessKey,  // ❌ Wrong header
}

// Would produce URLs like:
// https://170.168.61.164:13069/api/server ❌
// https://170.168.61.164:13069/api/access-keys ❌
// Returns: 404 - /api/server does not exist
```

## AFTER (✅ Correct)
```javascript
// New code that works:
path: `/${this.adminAccessKey}/${path}`,
headers: {
  'Content-Type': 'application/json',
}

// Now produces correct URLs:
// https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ/server ✅
// https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ/access-keys ✅
// Returns: 200 - Valid JSON response
```

## All Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/server` | GET | Get server info (name, version, port) |
| `/access-keys` | GET | List all access keys |
| `/access-keys` | POST | Create new access key |
| `/access-keys/{id}` | GET | Get specific access key |
| `/access-keys/{id}` | PUT | Update access key (rename, limit) |
| `/access-keys/{id}` | DELETE | Delete access key |
| `/metrics/transfer` | GET | Get data transfer by user ID |
| `/metrics/enabled` | GET | Check if metrics enabled |

## Testing with cURL

### Test Connection
```bash
curl -k https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ/server
```

### List Users
```bash
curl -k https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ/access-keys
```

### Get Metrics
```bash
curl -k https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ/metrics/transfer
```

### Create New User
```bash
curl -k -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"New User"}' \
  https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ/access-keys
```

## Response Formats

### Server Info Response
```json
{
  "name": "Outline Server",
  "serverId": "0e321d0a-5060-4410-b5ac-61b10aab86a4",
  "version": "1.12.3",
  "portForNewAccessKeys": 42061,
  "metricsEnabled": false,
  "createdTimestampMs": 1768470974314,
  "host": "170.168.61.164",
  "hostnameForAccessKeys": "170.168.61.164"
}
```

### Access Keys Response
```json
{
  "accessKeys": [
    {
      "id": "0",
      "name": "Default",
      "password": "uFeyQgN7Ht5s16iSbrSSgQ",
      "port": 42061,
      "method": "chacha20-ietf-poly1305",
      "dataLimit": { "bytes": 20000000000 },
      "accessUrl": "ss://Y2hhY2hhMjAtaWV0..."
    },
    {
      "id": "2",
      "name": "San Gyi",
      "password": "Af3c3gIKDxMl8pAgZJxGyw",
      "port": 42061,
      "method": "chacha20-ietf-poly1305",
      "dataLimit": { "bytes": 20000000000 },
      "accessUrl": "ss://Y2hhY2hhMjAtaWV0..."
    }
  ]
}
```

### Metrics Response
```json
{
  "bytesTransferredByUserId": {
    "0": 20117183466,
    "2": 2676086633,
    "3": 3346958077
  }
}
```

## Key Points

1. **Admin Key in URL**: Part of path, not header
2. **No /api/ prefix**: Endpoints go directly under the admin key
3. **Separate endpoints**: Access keys and metrics are separate calls
4. **SSL**: Use `-k` flag with curl for self-signed certs
5. **Metrics**: Only available if `metricsEnabled: true` on server

## Integration Code

```javascript
// Configure service with your server details
const server = {
  vpnType: 'outline',
  host: '170.168.61.164',
  outline: {
    apiBaseUrl: '170.168.61.164',
    apiPort: 13069,
    adminAccessKey: 'qjv7AuyJ36z1oqiuQ6BivQ',
    accessMethod: 'api',
  }
};

const service = new OutlineService(server);

// Now all calls use correct format automatically
await service.checkHealth();           // ✅ Works
await service.getServerStats();        // ✅ Works  
await service.getUserStats('0');       // ✅ Works
await service.addUser({ name: 'test' }); // ✅ Works
```
