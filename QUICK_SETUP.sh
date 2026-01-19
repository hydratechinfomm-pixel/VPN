#!/bin/bash

# WireGuard Control Panel - Quick Setup Script
# For Ubuntu 24.04

echo "=========================================="
echo "WireGuard Control Panel Setup"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root or with sudo"
    exit 1
fi

# Update system
echo "Updating system..."
apt update && apt upgrade -y

# Install WireGuard
echo "Installing WireGuard..."
apt install wireguard wireguard-tools -y

# Enable IP forwarding
echo "Enabling IP forwarding..."
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
echo "net.ipv6.conf.all.forwarding=1" >> /etc/sysctl.conf
sysctl -p

# Create WireGuard directory
echo "Creating WireGuard directory..."
mkdir -p /etc/wireguard
cd /etc/wireguard

# Generate keys
echo "Generating server keys..."
wg genkey | tee server_private.key
cat server_private.key | wg pubkey | tee server_public.key
chmod 600 server_private.key
chmod 644 server_public.key

echo ""
echo "=========================================="
echo "WireGuard Server Keys Generated!"
echo "=========================================="
echo "Private Key: /etc/wireguard/server_private.key"
echo "Public Key: /etc/wireguard/server_public.key"
echo ""
echo "IMPORTANT: Save your server public key:"
cat server_public.key
echo ""
echo "=========================================="
echo "Next Steps:"
echo "1. Edit /etc/wireguard/wg0.conf with your configuration"
echo "2. Start WireGuard: systemctl start wg-quick@wg0"
echo "3. Enable on boot: systemctl enable wg-quick@wg0"
echo "4. Configure firewall: ufw allow 51820/udp"
echo "=========================================="
