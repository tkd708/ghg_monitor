# Deployment Guide

This guide covers deploying the GHG Monitor application to various environments.

## 🌐 Production Deployment Options

### Option 1: Docker Deployment (Recommended)

#### Prerequisites
- Docker and Docker Compose installed
- Domain name (optional)
- SSL certificate (for HTTPS)

#### Quick Deploy with Docker Compose

1. **Clone and prepare the repository**
```bash
git clone https://github.com/yourusername/ghg-monitor.git
cd ghg-monitor
```

2. **Create production environment files**
```bash
# Backend environment
cat > backend/.env.production << EOF
NODE_ENV=production
PORT=3001
JWT_SECRET=$(openssl rand -base64 32)
DATA_PATH=/app/data
LOG_LEVEL=info
CORS_ORIGIN=https://yourdomain.com
EOF

# Frontend environment  
cat > frontend/.env.production << EOF
VITE_API_URL=https://api.yourdomain.com
VITE_APP_NAME=GHG Monitor
EOF
```

3. **Create Docker Compose file**
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  ghg-monitor-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    
  ghg-monitor-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - ghg-monitor-backend
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl/certs
    depends_on:
      - ghg-monitor-frontend
      - ghg-monitor-backend
    restart: unless-stopped
```

4. **Deploy**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Cloud Platform Deployment

#### Vercel (Frontend) + Railway (Backend)

**Frontend on Vercel:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel --prod
```

**Backend on Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy backend
cd backend
railway login
railway init
railway up
```

#### Heroku Deployment
```bash
# Install Heroku CLI
# Create Heroku apps
heroku create ghg-monitor-api
heroku create ghg-monitor-app

# Deploy backend
cd backend
git push heroku main

# Deploy frontend
cd ../frontend
git push heroku main
```

### Option 3: VPS/Server Deployment

#### Ubuntu/Debian Server Setup

1. **Server preparation**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install nginx
```

2. **Application setup**
```bash
# Clone repository
git clone https://github.com/yourusername/ghg-monitor.git
cd ghg-monitor

# Build backend
cd backend
npm install --production
npm run build

# Build frontend
cd ../frontend
npm install
npm run build

# Copy frontend build to web directory
sudo cp -r dist/* /var/www/ghg-monitor/
```

3. **PM2 configuration**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ghg-monitor-api',
    script: './backend/dist/index.js',
    cwd: '/path/to/ghg-monitor',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      JWT_SECRET: 'your-secret-key'
    },
    instances: 'max',
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G'
  }]
}
```

4. **Start with PM2**
```bash
pm2 start ecosystem.config.js
pm2 startup
pm2 save
```

5. **Nginx configuration**
```nginx
# /etc/nginx/sites-available/ghg-monitor
server {
    listen 80;
    server_name yourdomain.com;
    
    # Frontend
    location / {
        root /var/www/ghg-monitor;
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

6. **Enable site and restart Nginx**
```bash
sudo ln -s /etc/nginx/sites-available/ghg-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔒 SSL/HTTPS Setup

### Using Let's Encrypt (Free)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Monitoring and Logging

### Application Monitoring
```bash
# PM2 monitoring
pm2 monit

# Check logs
pm2 logs ghg-monitor-api

# Restart if needed
pm2 restart ghg-monitor-api
```

### System Monitoring
```bash
# Install monitoring tools
sudo apt install htop iotop

# Monitor system resources
htop

# Check disk usage
df -h

# Monitor logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install and test backend
        run: |
          cd backend
          npm ci
          npm test
      
      - name: Install and test frontend
        run: |
          cd frontend
          npm ci
          npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /path/to/ghg-monitor
            git pull origin main
            cd backend
            npm install --production
            npm run build
            cd ../frontend
            npm install
            npm run build
            sudo cp -r dist/* /var/www/ghg-monitor/
            pm2 restart ghg-monitor-api
```

## 🐳 Docker Production Files

### Backend Dockerfile
```dockerfile
# backend/Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

EXPOSE 3001

USER node

CMD ["node", "dist/index.js"]
```

### Frontend Dockerfile
```dockerfile
# frontend/Dockerfile.prod
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

## 🔧 Environment Variables

### Production Environment Variables

**Backend:**
```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secure-secret-key
DATA_PATH=/app/data
LOG_LEVEL=info
CORS_ORIGIN=https://yourdomain.com
```

**Frontend:**
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_APP_NAME=GHG Monitor Production
```

## 🚀 Performance Optimization

### Backend Optimizations
- Enable compression middleware
- Implement Redis caching for frequent queries
- Use cluster mode with PM2
- Optimize database queries
- Set up CDN for static assets

### Frontend Optimizations  
- Enable Gzip compression in Nginx
- Implement service worker for caching
- Use lazy loading for components
- Optimize bundle size with tree shaking
- Set up proper cache headers

## 🔍 Troubleshooting

### Common Issues

**Port conflicts:**
```bash
sudo lsof -i :3001
sudo kill -9 <PID>
```

**Permission issues:**
```bash
sudo chown -R $USER:$USER /path/to/ghg-monitor
chmod +x scripts/*.sh
```

**Memory issues:**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

**Database connection issues:**
```bash
# Check file permissions
ls -la data/
sudo chown -R node:node data/
```

## 📈 Scaling Considerations

- **Load Balancing**: Use Nginx upstream for multiple backend instances
- **Database**: Consider PostgreSQL for larger datasets
- **Caching**: Implement Redis for session storage and data caching
- **CDN**: Use CloudFlare or AWS CloudFront for global distribution
- **Monitoring**: Set up Prometheus + Grafana for metrics

## 🔐 Security Checklist

- [ ] HTTPS enabled with valid SSL certificate
- [ ] JWT secrets are random and secure
- [ ] CORS properly configured
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] File upload restrictions in place
- [ ] Security headers configured in Nginx
- [ ] Regular security updates scheduled
- [ ] Backup procedures implemented
- [ ] Access logs monitored