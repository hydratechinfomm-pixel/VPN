#!/bin/bash

# Complete Nginx certificate and configuration fix
# This script will find existing certs or create new ones, then fix Nginx

set -e

echo "=== V2Ray Nginx SSL Certificate Fix ==="
echo ""

# Check what certificate files exist
echo "Step 1: Checking for existing certificate files..."
echo ""

CERT_PATHS=(
  "/etc/ssl/certs/xray-server.crt"
  "/etc/ssl/certs/server.crt"
  "/etc/ssl/private/xray-server.key"
  "/etc/ssl/private/server.key"
)

FOUND_CERT=""
FOUND_KEY=""

for path in "${CERT_PATHS[@]}"; do
  if [ -f "$path" ]; then
    if [[ "$path" == *.crt ]]; then
      FOUND_CERT="$path"
      echo "✓ Found certificate: $FOUND_CERT"
    else
      FOUND_KEY="$path"
      echo "✓ Found key: $FOUND_KEY"
    fi
  fi
done

echo ""

# If certificates not found, create self-signed ones
if [ -z "$FOUND_CERT" ] || [ -z "$FOUND_KEY" ]; then
  echo "Step 2: Creating self-signed certificate..."
  
  CERT_PATH="/etc/ssl/certs/xray-server.crt"
  KEY_PATH="/etc/ssl/private/xray-server.key"
  
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_PATH" \
    -out "$CERT_PATH" \
    -subj "/CN=114.29.236.236/O=VPN Admin/C=SG"
  
  sudo chmod 644 "$CERT_PATH"
  sudo chmod 600 "$KEY_PATH"
  
  FOUND_CERT="$CERT_PATH"
  FOUND_KEY="$KEY_PATH"
  
  echo "✓ Created self-signed certificate at:"
  echo "  Cert: $FOUND_CERT"
  echo "  Key:  $FOUND_KEY"
else
  echo "Step 2: Skipping certificate creation (certificates found)"
fi

echo ""
echo "Step 3: Updating Nginx configuration..."
echo ""

# Create the corrected Nginx config with the found/created paths
sudo tee /etc/nginx/sites-available/xray-api > /dev/null <<EOFNGINX
# Upstream Xray API (local only)
upstream xray_api {
    server 127.0.0.1:8080;
}

# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name 114.29.236.236 _;
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS API Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name 114.29.236.236;
    
    # SSL Certificate Configuration
    ssl_certificate $FOUND_CERT;
    ssl_certificate_key $FOUND_KEY;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5:!3DES;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # API Token
    set \$api_token "139bf2b29eaad3dc71ca54856dccf6e0688f34a00d982f550329f5b49f50bcb4";
    
    # Health check endpoint (no auth required)
    location /health {
        access_log off;
        return 200 '{"status":"ok"}';
        add_header Content-Type application/json;
    }
    
    # Root location - API proxy with token validation
    location / {
        # Check for Bearer token format
        if (\$http_authorization !~ "^Bearer (.+)$") {
            return 401;
        }
        
        # Extract token value
        set \$auth_token "";
        if (\$http_authorization ~ "^Bearer (.+)$") {
            set \$auth_token \$1;
        }
        
        # Validate token matches
        if (\$auth_token != \$api_token) {
            return 401;
        }
        
        # Proxy to local Xray API
        proxy_pass http://xray_api;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # Buffering
        proxy_buffering off;
    }
    
    # Logging
    access_log /var/log/nginx/xray-api-access.log;
    error_log /var/log/nginx/xray-api-error.log;
}
EOFNGINX

echo "✓ Updated /etc/nginx/sites-available/xray-api"
echo ""

echo "Step 4: Testing Nginx configuration..."
echo ""

if sudo nginx -t; then
  echo "✓ Nginx configuration is valid"
  echo ""
  echo "Step 5: Reloading Nginx..."
  sudo systemctl reload nginx
  echo "✓ Nginx reloaded successfully"
else
  echo "✗ Nginx configuration test failed!"
  exit 1
fi

echo ""
echo "=== Complete ==="
echo ""
echo "Certificate paths being used:"
echo "  Cert: $FOUND_CERT"
echo "  Key:  $FOUND_KEY"
echo ""
echo "Nginx is now configured to:"
echo "  - Listen on port 443 (HTTPS)"
echo "  - Validate Bearer token: 139bf2b29eada..."
echo "  - Proxy to local Xray API on 127.0.0.1:8080"
echo ""
echo "Next steps:"
echo "1. Update panel MongoDB with correct access method (api or ssh)"
echo "2. Test device creation again"
