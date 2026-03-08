#!/bin/bash

# This script creates a simple HTTP API wrapper around v2ray-cli
# It listens on port 6000 and translates HTTP requests to v2ray-cli commands
# Install on the V2Ray server (114.29.236.236)

cat > /tmp/v2ray-http-api.js <<'APIEOFEOF'
/**
 * Xray HTTP API Wrapper
 * Provides HTTP endpoints that call v2ray-cli behind the scenes
 * Runs on port 6000 (local, needs to be proxied through Nginx on 443)
 * 
 * Usage:
 *   POST /users - Add user
 *   GET /stats/:email - Get user stats
 */

const express = require('express');
const { execSync } = require('child_process');
const app = express();

app.use(express.json());

// Helper: Execute v2ray-cli command
function executeV2rayCli(cmd) {
  try {
    const output = execSync(`v2ray-cli ${cmd}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return JSON.parse(output.trim());
  } catch (err) {
    throw new Error(`v2ray-cli failed: ${err.message}`);
  }
}

// Add user endpoint
app.post('/users', (req, res) => {
  try {
    const { name, limit, expiresAt } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Missing "name" field' });
    }

    // Build v2ray-cli command
    let cmd = `add-user --name "${name}"`;
    if (limit) cmd += ` --limit ${limit}`;
    if (expiresAt) cmd += ` --expires "${expiresAt}"`;

    console.log(`[addUser] Executing: v2ray-cli ${cmd}`);
    
    const result = executeV2rayCli(cmd);
    
    console.log(`[addUser] Success: ${result.userId}`);

    res.json({
      success: true,
      id: result.userId,
      userId: result.userId,
      email: name,
      clientConfig: null // Panel handles vmess config generation
    });
  } catch (err) {
    console.error('[addUser] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Remove user endpoint
app.delete('/users/:email', (req, res) => {
  try {
    const { email } = req.params;
    
    console.log(`[removeUser] Removing: ${email}`);
    
    const result = executeV2rayCli(`remove-user "${email}"`);
    
    console.log(`[removeUser] Success for ${email}`);

    res.json({ success: true, email, ...result });
  } catch (err) {
    console.error('[removeUser] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get stats endpoint
app.get('/stats/:email', (req, res) => {
  try {
    const { email } = req.params;
    
    console.log(`[stats] Query for: ${email}`);
    
    const result = executeV2rayCli(`stats "${email}"`);
    
    res.json(result);
  } catch (err) {
    console.error('[stats] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Set data limit endpoint
app.post('/users/:email/limit', (req, res) => {
  try {
    const { email } = req.params;
    const { limit } = req.body;
    
    console.log(`[setLimit] Setting limit for ${email}: ${limit}`);
    
    const result = executeV2rayCli(`set-limit "${email}" ${limit}`);
    
    res.json({ success: true, email, ...result });
  } catch (err) {
    console.error('[setLimit] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  try {
    const health = executeV2rayCli('health');
    res.json(health);
  } catch (err) {
    res.status(503).json({ error: 'v2ray-cli unavailable' });
  }
});

const PORT = 6000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ Xray HTTP API wrapper listening on 127.0.0.1:${PORT}`);
  console.log(`  Backend: v2ray-cli`);
  console.log(`  Panel should proxy to: http://127.0.0.1:${PORT}`);
});
APIEOFEOF

chmod +x /tmp/v2ray-http-api.js

echo "✓ Created /tmp/v2ray-http-api.js"
echo ""
echo "To start the service:"
echo "  node /tmp/v2ray-http-api.js"
echo ""
echo "To run as a systemd service:"
echo "  sudo cp /tmp/v2ray-http-api.js /usr/local/bin/"
echo "  sudo tee /etc/systemd/system/v2ray-http-api.service > /dev/null <<'EOF'"
echo "[Unit]"
echo "Description=Xray HTTP API Wrapper"
echo "After=xray.service"
echo ""
echo "[Service]"
echo "Type=simple"
echo "User=root"
echo "ExecStart=/usr/bin/node /usr/local/bin/v2ray-http-api.js"
echo "Restart=on-failure"
echo "RestartSec=5s"
echo ""
echo "[Install]"
echo "WantedBy=multi-user.target"
echo "EOF"
echo ""
echo "Then:"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl enable v2ray-http-api"
echo "  sudo systemctl start v2ray-http-api"
