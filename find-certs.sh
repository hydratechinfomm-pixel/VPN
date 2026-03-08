#!/bin/bash

# Find what certificate files are actually configured in nginx
echo "Checking current Nginx SSL configuration..."
echo ""

# Check what Nginx is currently using
echo "Current Nginx SSL config:"
grep -r "ssl_certificate" /etc/nginx/sites-enabled/
echo ""

# Find all certificate files on the system
echo "Finding all certificate files..."
echo "---"

find /etc/ssl -name "*.crt" -o -name "*.pem" 2>/dev/null | sort
find /usr/local/etc -name "*.crt" -o -name "*.pem" 2>/dev/null | sort

echo ""
echo "---"
echo "Finding all key files..."
echo "---"

find /etc/ssl -name "*.key" 2>/dev/null | sort
find /usr/local/etc -name "*.key" 2>/dev/null | sort

echo ""
echo "---"
echo "Checking SSL certificate validity..."
echo ""

# Check each cert found
for cert in $(find /etc/ssl /usr/local/etc -name "*.crt" -o -name "*.pem" 2>/dev/null); do
  echo "Certificate: $cert"
  openssl x509 -in "$cert" -text -noout 2>/dev/null | grep -E "Subject:|Issuer:|Not Valid"
  echo ""
done
