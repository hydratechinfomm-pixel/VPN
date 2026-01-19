require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const systemInit = require('./utils/systemInit');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Initialize system on startup
systemInit.initializeSystem();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/access-keys', require('./routes/accessKeyRoutes')); // Keep for backward compatibility
app.use('/api/devices', require('./routes/deviceRoutes'));
app.use('/api/plans', require('./routes/planRoutes'));
app.use('/api/servers', require('./routes/serverRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  Outline VPN Control Panel API                      ║
║  Server running on http://localhost:${PORT}                 ║
║  Environment: ${process.env.NODE_ENV || 'development'}                   ║
╚══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;
