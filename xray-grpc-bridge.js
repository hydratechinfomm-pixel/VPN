/**
 * Xray gRPC-to-HTTP Bridge
 * Listens on port 8888 and proxies HTTP requests to the local Xray gRPC API on :8080
 * This allows the panel to communicate with Xray API via standard HTTP/HTTPS
 */

const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const app = express();
app.use(express.json());

// Load the required proto files for Xray
// Note: You'll need to extract these from Xray source or use pre-built proto definitions

const PROTO_PATH = path.join(__dirname, 'xray-proto');

// Create gRPC client
let handlerClient = null;
let statsClient = null;

function initializeGrpcClients() {
  try {
    // Load proto definitions
    const handlerProto = protoLoader.loadSync(
      path.join(PROTO_PATH, 'app/proxyman/command/command.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );

    const statsProto = protoLoader.loadSync(
      path.join(PROTO_PATH, 'app/stats/command/command.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );

    const handlerDescriptor = grpc.loadPackageDefinition(handlerProto);
    const statsDescriptor = grpc.loadPackageDefinition(statsProto);

    // Create clients pointing to localhost:8080
    handlerClient = new handlerDescriptor.xray.app.proxyman.command.HandlerService(
      '127.0.0.1:8080',
      grpc.credentials.createInsecure()
    );

    statsClient = new statsDescriptor.xray.app.stats.command.StatsService(
      '127.0.0.1:8080',
      grpc.credentials.createInsecure()
    );

    console.log('✓ gRPC clients initialized');
    return true;
  } catch (err) {
    console.warn('⚠ gRPC initialization failed, will try fallback:', err.message);
    return false;
  }
}

// HTTP endpoint to add a user
app.post('/users', (req, res) => {
  const { name, limit, expiresAt } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Missing "name" field' });
  }

  // Generate UUID for user
  const { v4: uuidv4 } = require('uuid');
  const userId = uuidv4();

  console.log(`Adding user via gRPC: ${name} (${userId})`);

  if (!handlerClient) {
    return res.status(503).json({ error: 'gRPC bridge not initialized' });
  }

  // Create AddUserRequest for gRPC
  const request = {
    user: {
      level: 0,
      email: name, // Use name as email/identifier
    }
  };

  // Call gRPC AddUser
  handlerClient.AddUser(request, (err, response) => {
    if (err) {
      console.error('gRPC AddUser failed:', err.message);
      return res.status(500).json({ error: `Failed to add user: ${err.message}` });
    }

    console.log('✓ User added via gRPC');

    // Return user info in the format the panel expects
    res.json({
      success: true,
      userId: name, // Use email/name as identifier since Xray uses email field
      id: name,
      clientConfig: null, // Panel will handle vmess config generation
      vmess: null
    });
  });
});

// HTTP endpoint to get stats
app.get('/stats/:identifier', (req, res) => {
  const { identifier } = req.params;

  console.log(`Querying stats for: ${identifier}`);

  if (!statsClient) {
    return res.status(503).json({ error: 'gRPC bridge not initialized' });
  }

  const request = {
    pattern: `user>>>${identifier}>>>traffic`
  };

  statsClient.QueryStats(request, (err, response) => {
    if (err) {
      console.error('gRPC QueryStats failed:', err.message);
      return res.status(500).json({ error: `Failed to query stats: ${err.message}` });
    }

    res.json(response);
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', bridge: 'grpc-http-bridge' });
});

// Initialize and start server
const PORT = process.env.BRIDGE_PORT || 8888;

console.log('Starting Xray gRPC-to-HTTP Bridge...');

const initialized = initializeGrpcClients();

if (!initialized) {
  console.warn('⚠ Warning: gRPC initialization failed. Attempting fallback mode...');
  console.warn('  Install: npm install @grpc/grpc-js @grpc/proto-loader uuid');
}

app.listen(PORT, '127.0.0.1', () => {
  console.log(`✓ Bridge listening on 127.0.0.1:${PORT}`);
  console.log(`  Proxy target: 127.0.0.1:8080 (Xray gRPC API)`);
  console.log(`  Nginx should proxy to: http://127.0.0.1:${PORT}`);
});
