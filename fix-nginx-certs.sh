#!/bin/bash

echo "Finding certificate files on V2Ray server..."
echo ""

# Find certificate files
echo "Searching for .crt and .key files..."
echo "---"

# Common locations
LOCATIONS=(
  "/etc/ssl/certs"
  "/etc/ssl/private"
  "/usr/local/etc/xray"
  "/usr/local/etc/v2ray"
  "/etc/xray"
  "/etc/v2ray"
)

CERT_FILE=""
KEY_FILE=""

for loc in "${LOCATIONS[@]}"; do
  if [ -d "$loc" ]; then
    echo "Checking $loc:"
    ls -la "$loc" 2>/dev/null | grep -E '\.(crt|pem|key)$' || echo "  (no cert files found)"
    echo ""
  fi
done

echo "---"
echo "Please identify the correct certificate paths from above."
echo ""
echo "Once you find them, update this script with the correct paths:"
echo "  CERT_FILE=\"/path/to/cert.crt\""
echo "  KEY_FILE=\"/path/to/key.key\""
echo ""
echo "Then run the nginx-update part below."
