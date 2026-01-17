# Outline VPN Control Panel - API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
All endpoints (except auth) require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Response Format
All responses are JSON:
```json
{
  "message": "Success message",
  "data": {},
  "error": "Error message (if any)"
}
```

---

## Authentication Endpoints

### Register User
**POST** `/auth/register`

Request:
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

Response:
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { }
}
```

### Login
**POST** `/auth/login`

Request:
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}
```

Response:
```json
{
  "message": "Login successful",
  "token": "...",
  "refreshToken": "...",
  "user": { }
}
```

### Refresh Token
**POST** `/auth/refresh-token`

Request:
```json
{
  "refreshToken": "..."
}
```

Response:
```json
{
  "token": "...",
  "refreshToken": "..."
}
```

### Get Current User
**GET** `/auth/me`

Response:
```json
{
  "_id": "...",
  "username": "john_doe",
  "email": "john@example.com",
  "role": "user",
  "plan": "FREE",
  "accessKeys": [ ],
  "allowedServers": [ ]
}
```

### Change Password
**POST** `/auth/change-password`

Request:
```json
{
  "currentPassword": "OldPassword123",
  "newPassword": "NewPassword123"
}
```

### Update Profile
**PUT** `/auth/profile`

Request:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "country": "US",
  "timezone": "America/New_York"
}
```

---

## Access Key Endpoints

### Create Access Key
**POST** `/access-keys`

Request:
```json
{
  "serverId": "server_id",
  "name": "My Laptop",
  "dataLimit": 10737418240,
  "expiresAt": "2024-12-31T23:59:59Z"
}
```

Response:
```json
{
  "message": "Access key created successfully",
  "accessKey": {
    "_id": "...",
    "keyId": "uuid",
    "name": "My Laptop",
    "accessUrl": "ss://...",
    "port": 8388,
    "dataLimit": { "bytes": 10737418240 },
    "status": "ACTIVE"
  }
}
```

### Get User Access Keys
**GET** `/access-keys?serverId=id&status=ACTIVE`

Query Parameters:
- `serverId` (optional): Filter by server
- `status` (optional): Filter by status (ACTIVE, SUSPENDED, EXPIRED, DISABLED)

Response:
```json
{
  "total": 5,
  "accessKeys": [ ]
}
```

### Get Single Access Key
**GET** `/access-keys/:keyId`

### Update Access Key
**PUT** `/access-keys/:keyId`

Request:
```json
{
  "name": "Updated Name",
  "dataLimit": 5368709120,
  "expiresAt": "2024-06-30T23:59:59Z"
}
```

### Delete Access Key
**DELETE** `/access-keys/:keyId`

### Change Access Key Status
**PATCH** `/access-keys/:keyId/status`

Request:
```json
{
  "status": "SUSPENDED"
}
```

Valid statuses: `ACTIVE`, `SUSPENDED`, `EXPIRED`, `DISABLED`

---

## Server Endpoints (Admin Only)

### Get All Servers
**GET** `/servers?region=US&provider=AWS&isActive=true`

Query Parameters:
- `region` (optional): US, EU, ASIA, SOUTH_AMERICA, AFRICA, OCEANIA
- `provider` (optional): AWS, Google Cloud, Azure, DigitalOcean, Linode, Custom
- `isActive` (optional): true/false

### Get Accessible Servers
**GET** `/servers/accessible`

Returns servers the current user has access to.

### Create Server
**POST** `/servers`

Request:
```json
{
  "name": "US Server 1",
  "description": "Primary US server",
  "host": "123.45.67.89",
  "port": 8388,
  "apiUrl": "https://123.45.67.89:7837",
  "region": "US",
  "country": "United States",
  "city": "New York",
  "provider": "AWS",
  "apiToken": "..."
}
```

### Get Server Details
**GET** `/servers/:serverId`

### Update Server
**PUT** `/servers/:serverId`

Request:
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "region": "EU",
  "provider": "Google Cloud"
}
```

### Delete Server
**DELETE** `/servers/:serverId`

### Server Health Check
**POST** `/servers/:serverId/health-check`

Response:
```json
{
  "healthy": true,
  "data": { }
}
```

### Get Server Metrics
**GET** `/servers/:serverId/metrics`

Response:
```json
{
  "bytesTransferred": {
    "key_id": 1073741824
  },
  "asn": {
    "number": 15169,
    "organization": "Google"
  }
}
```

### Get Server Access Keys
**GET** `/servers/:serverId/access-keys`

---

## User Management Endpoints (Admin Only)

### Get All Users
**GET** `/users?role=user&plan=PREMIUM&isActive=true`

Query Parameters:
- `role` (optional): admin, moderator, user
- `plan` (optional): FREE, PREMIUM, ENTERPRISE
- `isActive` (optional): true/false

### Get User Details
**GET** `/users/:userId`

### Update User
**PUT** `/users/:userId`

Request:
```json
{
  "role": "moderator",
  "plan": "PREMIUM",
  "isActive": true,
  "allowedServers": ["server_id_1", "server_id_2"]
}
```

### Delete User
**DELETE** `/users/:userId`

### Get User Activity Logs
**GET** `/users/:userId/activity?action=LOGIN&limit=50`

Query Parameters:
- `action` (optional): LOGIN, LOGOUT, CREATE_KEY, DELETE_KEY, etc.
- `limit` (optional): Max results (default: 50)

### Get User Data Usage
**GET** `/users/:userId/data-usage`

Response:
```json
{
  "userId": "...",
  "plan": "PREMIUM",
  "totalDataUsage": 1073741824,
  "dataUsageGB": "1.00",
  "accessKeysUsage": [
    {
      "keyId": "...",
      "name": "My Device",
      "dataUsageGB": "0.50",
      "limitGB": "10.00"
    }
  ]
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": [
    {
      "msg": "Invalid value",
      "param": "email",
      "location": "body"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied"
}
```

### 404 Not Found
```json
{
  "error": "User not found"
}
```

### 500 Server Error
```json
{
  "error": "Internal server error",
  "message": "Error details (development only)"
}
```

---

## HTTP Status Codes

- `200 OK` - Request successful
- `201 Created` - Resource created
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Server Error` - Server error

---

## Rate Limiting (Future)

When implemented:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1234567890
```

---

## Examples

### Complete User Registration & Login Flow

1. Register:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "user@example.com",
    "password": "SecurePass123",
    "firstName": "User",
    "lastName": "Name"
  }'
```

2. Login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

3. Get token from response, then:
```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## Version

API Version: 1.0.0

Last Updated: January 2024
