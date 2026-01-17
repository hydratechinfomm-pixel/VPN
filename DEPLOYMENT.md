# Outline VPN Control Panel - Complete Architecture & Deployment Guide

## 🏗️ System Architecture

### Overview
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│               (http://localhost:3000)                       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/REST API
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Backend API (Express.js)                       │
│          (http://localhost:5000/api)                        │
├──────────────┬──────────────┬──────────────┬────────────────┤
│  Auth Routes │ Key Routes   │ Server Routes│ User Routes    │
└──────────────┴──────────────┴──────────────┴────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼────────┐  ┌───▼──────┐  ┌────▼───────────────┐
│  MongoDB       │  │ Outline  │  │ Background         │
│  Database      │  │ VPN API  │  │ Jobs (Cron)        │
└────────────────┘  └──────────┘  └────────────────────┘
```

### Components

#### 1. **Frontend (React)**
- Single Page Application (SPA)
- User authentication and authorization
- Dashboard with statistics
- Access key management interface
- Server management panel (admin)
- User management panel (admin)
- Profile and settings
- Activity logs viewer

#### 2. **Backend API (Node.js/Express)**
- RESTful API endpoints
- JWT authentication
- Role-based access control
- Request validation
- Error handling
- Logging and audit trails

#### 3. **Database (MongoDB)**
- User data
- Access keys
- VPN servers
- Activity logs
- Statistics and metrics

#### 4. **Outline Integration**
- Direct API communication with Outline servers
- Access key management
- Server metrics and monitoring
- Health checks

#### 5. **Background Tasks**
- Server health checks (every 5 minutes)
- Data synchronization (hourly)
- Access key expiration (daily)
- Metrics collection

---

## 📊 Database Schema

### User Collection
```javascript
{
  _id: ObjectId,
  username: String (unique),
  email: String (unique),
  password: String (hashed),
  firstName: String,
  lastName: String,
  role: String (admin|moderator|user),
  plan: String (FREE|PREMIUM|ENTERPRISE),
  isActive: Boolean,
  accessKeys: [ObjectId],
  allowedServers: [ObjectId],
  dataUsage: {
    bytes: Number,
    lastReset: Date
  },
  profile: {
    phone: String,
    country: String,
    timezone: String,
    avatar: String
  },
  securitySettings: {
    twoFactorEnabled: Boolean,
    twoFactorSecret: String,
    lastLoginAt: Date,
    loginAttempts: Number,
    lockedUntil: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### VPN Server Collection
```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  host: String,
  port: Number,
  apiUrl: String,
  apiCertFingerprint: String,
  managementApiPort: Number,
  region: String,
  country: String,
  city: String,
  provider: String,
  isActive: Boolean,
  maxAccessKeys: Number,
  accessKeys: [ObjectId],
  stats: {
    totalUsers: Number,
    totalDataTransferred: Number,
    uptime: Number,
    lastHealthCheck: Date,
    isHealthy: Boolean
  },
  credentials: {
    apiToken: String,
    password: String
  },
  settings: {
    ipv6Enabled: Boolean,
    metricsEnabled: Boolean,
    allowedCountries: [String],
    blockedCountries: [String]
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Access Key Collection
```javascript
{
  _id: ObjectId,
  keyId: String (unique),
  user: ObjectId (ref: User),
  server: ObjectId (ref: VpnServer),
  name: String,
  accessUrl: String,
  port: Number,
  method: String,
  password: String,
  status: String (ACTIVE|SUSPENDED|EXPIRED|DISABLED),
  expiresAt: Date,
  isUnlimited: Boolean,
  dataLimit: {
    bytes: Number,
    isEnabled: Boolean
  },
  dataUsage: {
    bytes: Number,
    lastReset: Date
  },
  metadata: {
    devices: [{ name, os, lastConnected }],
    notes: String
  },
  connectivity: {
    lastConnectedAt: Date,
    isConnected: Boolean,
    connectionCount: Number
  },
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Activity Log Collection
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  action: String (LOGIN|LOGOUT|CREATE_KEY|etc),
  resource: String (USER|ACCESS_KEY|SERVER|PROFILE),
  resourceId: ObjectId,
  details: Map<String, String>,
  ipAddress: String,
  userAgent: String,
  status: String (SUCCESS|FAILED|PENDING),
  errorMessage: String,
  createdAt: Date
}
```

---

## 🔐 Security Considerations

### Authentication & Authorization
- JWT tokens with expiration
- Refresh token rotation
- Password hashing with bcryptjs
- Role-based access control (RBAC)
- Activity logging and audit trails

### Data Protection
- HTTPS/TLS for all communications
- Secure password requirements
- Credential encryption in database
- CORS configured for frontend only
- Input validation and sanitization

### API Security
- Token validation on protected routes
- Rate limiting (to be implemented)
- CSRF protection (if using cookies)
- SQL injection prevention (using MongoDB)
- XSS protection

### Best Practices
1. Never commit `.env` files
2. Use strong JWT secret in production
3. Enable HTTPS/SSL in production
4. Regular security updates
5. Monitor activity logs
6. Backup database regularly
7. Use environment-specific configs
8. Implement rate limiting
9. Enable 2FA for admin users
10. Regular security audits

---

## 🚀 Deployment Options

### Option 1: Docker (Recommended)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server server
COPY .env.production .env

EXPOSE 5000

CMD ["node", "server/index.js"]
```

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/outline-vpn
    depends_on:
      - mongo
    restart: always

  mongo:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: always

volumes:
  mongo-data:
```

Deploy:
```bash
docker-compose up -d
```

### Option 2: AWS (EC2 + RDS)

1. Launch EC2 instance (Ubuntu 20.04 LTS)
2. Install Node.js and npm
3. Deploy using PM2:
```bash
npm install -g pm2
pm2 start server/index.js
pm2 startup
pm2 save
```

4. Use RDS for MongoDB or MongoDB Atlas
5. Configure security groups
6. Use Route53 for DNS
7. Set up CloudFront for frontend

### Option 3: Heroku

```bash
heroku create outline-vpn-api
heroku addons:create mongolab
heroku config:set JWT_SECRET=your-secret
git push heroku main
```

### Option 4: DigitalOcean App Platform

1. Connect GitHub repository
2. Set environment variables
3. Deploy
4. Use DigitalOcean Spaces for storage

### Option 5: Traditional VPS

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repository
git clone <repo> /var/www/outline-vpn
cd /var/www/outline-vpn

# Install dependencies
npm install --production

# Set up environment
cp .env.example .env
# Edit .env with production values

# Start with PM2
npm install -g pm2
pm2 start server/index.js
```

---

## 📦 Production Checklist

### Before Deployment
- [ ] Change JWT_SECRET to random strong value
- [ ] Set NODE_ENV=production
- [ ] Configure MONGODB_URI for production database
- [ ] Set CORS_ORIGIN to frontend domain
- [ ] Enable HTTPS/SSL certificate
- [ ] Set up environment variables securely
- [ ] Configure rate limiting
- [ ] Set up logging and monitoring
- [ ] Enable database backups
- [ ] Test all endpoints
- [ ] Set up error tracking (Sentry)
- [ ] Configure CDN for static files

### Database
- [ ] Set up MongoDB Atlas cluster (or self-hosted)
- [ ] Configure IP whitelist
- [ ] Enable backups
- [ ] Test restore procedure
- [ ] Set up indexing for performance
- [ ] Configure read replicas for high availability

### Monitoring & Logging
- [ ] Set up PM2 monitoring
- [ ] Configure application logs
- [ ] Set up error tracking
- [ ] Monitor server resources
- [ ] Set up alerts for critical issues
- [ ] Configure log rotation

### Backup & Disaster Recovery
- [ ] Daily database backups
- [ ] Test backup restoration
- [ ] Document recovery procedures
- [ ] Set up replication
- [ ] Plan for failover

---

## 📈 Scaling Considerations

### Horizontal Scaling
```
Load Balancer (Nginx/HAProxy)
├── API Server 1
├── API Server 2
└── API Server 3
    └── MongoDB (Replica Set)
```

### Caching Layer
- Add Redis for session caching
- Cache server metrics
- Cache access key lists

### Database Optimization
- Add indexes on frequently queried fields
- Partition large collections
- Archive old activity logs
- Use MongoDB replication

### Code Optimization
- Implement pagination
- Add query pagination limits
- Optimize MongoDB queries
- Use connection pooling

---

## 🛠️ Maintenance

### Regular Tasks
- Monitor API performance
- Review activity logs
- Check server health
- Verify backups
- Update dependencies
- Apply security patches
- Monitor storage usage
- Review and clean logs

### Upgrades
- Test updates in staging environment
- Plan maintenance window
- Backup database before updates
- Monitor after deployment
- Have rollback plan ready

### Scaling
- Monitor resource usage
- Plan for growth
- Load test before major changes
- Implement caching strategies
- Consider CDN usage

---

## 📞 Troubleshooting Production Issues

### API Not Responding
```bash
# Check if service is running
pm2 list

# View logs
pm2 logs

# Restart service
pm2 restart server/index.js
```

### High Memory Usage
```bash
# Check process memory
ps aux | grep node

# Increase PM2 memory limit
pm2 delete server/index.js
pm2 start server/index.js --max-memory-restart 500M
```

### Database Connection Issues
```bash
# Check MongoDB connection
mongo "your-connection-string"

# Check credentials
echo $MONGODB_URI

# Test connection timeout
ping your-mongo-server
```

### SSL Certificate Issues
```bash
# Verify certificate
openssl s_client -connect your-domain:443

# Renew Let's Encrypt (if using)
certbot renew
```

---

## 📚 Additional Resources

- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Outline API Docs](https://getoutline.org/)
- [Docker Documentation](https://docs.docker.com/)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)

---

## 🎯 Future Enhancements

1. **Advanced Analytics**
   - Custom date range reports
   - Performance metrics
   - User behavior analytics

2. **High Availability**
   - Database replication
   - Load balancing
   - Auto-scaling

3. **Advanced Features**
   - Webhook notifications
   - Custom branding
   - API key management
   - Batch operations

4. **Mobile App**
   - iOS native app
   - Android native app
   - Cross-platform (React Native)

5. **Advanced Security**
   - 2FA for all users
   - IP whitelisting
   - VPN tunneling for admin
   - Hardware security keys

6. **Integrations**
   - Payment gateway
   - Email service
   - SMS notifications
   - Slack integration

---

**Last Updated:** January 2024
**Version:** 1.0.0
