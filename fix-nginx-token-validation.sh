#!/bin/bash
# This script creates the CORRECT Nginx configuration that validates the API token

NGINX_CONFIG="/etc/nginx/sites-available/xray-api"
API_TOKEN="139bf2b29eaad3dc71ca54856dccf6e0688f34a00d982f550329f5b49f50bcb4"

echo "Creating corrected Nginx configuration at $NGINX_CONFIG"
echo "Token: $API_TOKEN"

sudo tee "$NGINX_CONFIG" > /dev/null <<'EOFNGINX'
# Upstream Xray API (local only)
upstream xray_api {
    server 127.0.0.1:8080;
}

# HTTP redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name 114.29.236.236 _;
    
    # Allow Let's Encrypt validation
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS API Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name 114.29.236.236;
    
    # SSL Certificate Configuration
    ssl_certificate /etc/ssl/certs/xray-server.crt;
    ssl_certificate_key /etc/ssl/private/xray-server.key;
    
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
    
    # API Token - REPLACE WITH YOUR ACTUAL TOKEN
    set $api_token "139bf2b29eaad3dc71ca54856dccf6e0688f34a00d982f550329f5b49f50bcb4";
    
    # Health check endpoint (no auth required)
    location /health {
        access_log off;
        return 200 '{"status":"ok"}';
        add_header Content-Type application/json;
    }
    
    # Root location - API proxy with token validation
    location / {
        # Extract token from Authorization: Bearer <token> header
        # First: Check if Authorization header exists and has Bearer prefix
        if ($http_authorization !~ "^Bearer ") {
            return 401;
        }
        
        # Extract the token part (everything after "Bearer ")
        # Using a regex variable to capture the token
        set $auth_token "";
        if ($http_authorization ~ "^Bearer (.+)$") {
            set $auth_token $1;
        }
        
        # Check if the extracted token matches the expected token
        if ($auth_token != $api_token) {
            return 401;
        }
        
        # If we get here, token is valid - proxy to local Xray API
        proxy_pass http://xray_api;
        proxy_http_version 1.1;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
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

# Test the configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Reload Nginx
echo "Reloading Nginx..."
sudo systemctl reload nginx

echo "Done! Configuration has been updated."
echo ""
echo "The Nginx config now:"
echo "1. Checks if Authorization header exists with Bearer prefix"
echo "2. Extracts the token value"
echo "3. Compares it against \$api_token variable"
echo "4. Returns 401 if token doesn't match"
echo ""
echo "Health endpoint (/health) still works without authentication."
