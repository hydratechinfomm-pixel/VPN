#!/bin/bash

# Update panel database to use SSH mode instead of API mode
# This tells the panel to use v2ray-cli via SSH for device management

echo "Connecting to panel MongoDB and updating V2Ray server config..."
echo ""

mongosh <<'MONGOEOF'
// Switch to panel database
use vpn_panel_db

// Update the server to use SSH access method (uses v2ray-cli)
db.vpnservers.updateOne(
  {host: "114.29.236.236"},
  {$set: {"v2ray.accessMethod": "ssh"}}
)

// Verify the change
var result = db.vpnservers.findOne({host: "114.29.236.236"})
console.log("\n=== Server Configuration Updated ===")
console.log("Server Name:", result.name)
console.log("Host:", result.host)
console.log("VPN Type:", result.vpnType)
console.log("Access Method:", result.v2ray.accessMethod)
console.log("\n✓ Now using SSH mode with v2ray-cli for user management")

MONGOEOF

echo ""
echo "=== Complete ==="
echo ""
echo "The panel will now:"
echo "  ✓ Connect to server via SSH"
echo "  ✓ Use v2ray-cli for device/user management"
echo "  ✓ Skip the problematic Nginx API proxy"
echo ""
echo "Next: Try creating a device in the panel!"
