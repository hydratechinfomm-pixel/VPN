module.exports = {
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-key-change-in-production',
  JWT_EXPIRES_IN: '7d',
  JWT_REFRESH_EXPIRES_IN: '30d',

  // API Configuration
  API_PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Outline API defaults
  OUTLINE_API_TIMEOUT: 10000,
  OUTLINE_API_PORTS: {
    SHADOWSOCKS: 8388,
  },

  // User roles
  ROLES: {
    ADMIN: 'admin',
    staff: 'staff',
    USER: 'user',
  },

  // Data transfer limits (in GB per month)
  DATA_LIMITS: {
    FREE: 10,
    PREMIUM: 100,
    ENTERPRISE: 1000,
  },

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Cache TTL (in seconds)
  CACHE_TTL: 3600,
};
