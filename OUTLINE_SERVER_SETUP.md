# How to Add Your Outline Server

## Step 1: Get Your Outline Admin Config

1. Open **Outline Manager** on your computer
2. Go to **Server Settings** (gear icon)
3. Find **"Management API URL"** section
4. You should see a JSON config like:
   ```json
   {
     "apiUrl":"https://170.168.61.164:13069/qjv7AuyJ36z1oqiuQ6BivQ",
     "certSha256":"475B7A040FB407CB7865C81C073CAEBF0707C38581A236F0B5F8D0F28AFF350C"
   }
   ```

## Step 2: Add Server to Control Panel

### Method A: Using JSON Import (Recommended)

1. Go to **Servers** page in the control panel
2. Click **"Add Server"**
3. Select **"Outline"** as VPN Type
4. Check the box: **"Import from Outline Manager JSON Config"**
5. Paste the JSON config you copied
6. Click **"Import Settings"**
7. Review the auto-filled fields:
   - **Management API Port**: 13069 (extracted from URL)
   - **Admin Access Key**: qjv7AuyJ36z1oqiuQ6BivQ (extracted from URL)
   - **Certificate SHA256**: Auto-filled if provided
8. Click **"Save Server"**

### Method B: Manual Entry

1. Go to **Servers** page
2. Click **"Add Server"**
3. Select **"Outline"** as VPN Type
4. Fill in the fields:
   - **Server Name**: e.g., "My Outline Server"
   - **Host/IP**: e.g., 170.168.61.164
   - **Management API Port**: e.g., 13069
   - **Admin Access Key**: Paste from Outline Manager
   - **Certificate SHA256**: (Optional) Paste if using custom cert
   - **Access Method**: "API" (recommended)
5. Click **"Save Server"**

## Step 3: Verify Connection

- The panel will automatically test the connection
- You should see a success message
- Server appears in the Servers list

## Troubleshooting

### Error: "Cannot connect to outline server"
- ✅ Check IP address is correct
- ✅ Check port is correct (usually 13069)
- ✅ Check admin key is correct (copy-paste from Outline Manager)
- ✅ Ensure firewall allows connection on the port
- ✅ Test manually: `curl -k https://[IP]:[PORT]/[ADMIN_KEY]/server`

### Error: "Admin access key is required"
- Copy the admin key from Outline Manager exactly
- Don't include any extra characters or spaces

### Error: "Connection timeout"
- The server might be offline
- Check network connectivity to the Outline server
- Verify firewall rules
- Try testing with `curl` first

## Features Supported

✅ View all connected users (access keys)  
✅ Monitor data usage per user  
✅ Create new access keys (users)  
✅ Delete access keys (revoke users)  
✅ Set data limits per user  
✅ View server statistics  
✅ Custom ports support  
✅ Self-signed certificate support  

## JSON Config Examples

### Production Server (Custom Port)
```json
{
  "apiUrl":"https://example.com:13069/longrandomadminkey123",
  "certSha256":"ABC123..."
}
```

### Local Server (Default Port)
```json
{
  "apiUrl":"https://192.168.1.100:8081/adminkey456",
  "certSha256":"XYZ789..."
}
```

### Non-SSL Server
```json
{
  "apiUrl":"http://192.168.1.100:8081/adminkey789",
  "certSha256":""
}
```

## API Port vs Access Port

- **Management API Port** (8081): Used by control panel to manage server  
- **Access Key Port** (8388): Used by VPN clients to connect (shown in user configs)
