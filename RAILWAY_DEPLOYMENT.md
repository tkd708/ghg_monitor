# GHG Monitor - Railway Deployment Guide

This guide explains how to deploy the GHG Monitor application to Railway as a single service.

## 🚀 Quick Start

### Prerequisites
- Railway account (https://railway.app)
- Railway CLI installed (`npm install -g @railway/cli`)
- GitHub repository with your code

### Deployment Steps

1. **Login to Railway**:
   ```bash
   railway login
   ```

2. **Create a new project**:
   ```bash
   railway create ghg-monitor
   ```

3. **Deploy the application**:
   ```bash
   railway up
   ```

4. **Set environment variables** in Railway dashboard:
   - Go to your project dashboard
   - Click on the service
   - Go to "Variables" tab
   - Add the following:
     ```
     NODE_ENV=production
     JWT_SECRET=your-super-secure-jwt-secret-here
     LOG_LEVEL=info
     ```

5. **Get your deployment URL**:
   - Railway will provide a URL like: `https://ghg-monitor.railway.app`
   - This serves both frontend and API

## 📁 Architecture

The application runs as a single Express server that:
- Serves the React frontend from `/`
- Handles API requests at `/api/*`
- Serves uploaded files from `/uploads/*`

```
Railway Service
├── Frontend (React) → Served at /
├── Backend API     → Served at /api/*
└── Static Files    → Served at /uploads/*
```

## 🔧 Configuration Details

### Build Process
Railway automatically:
1. Builds the frontend (React/Vite)
2. Builds the backend (TypeScript)
3. Starts the Express server

### Environment Variables
Required variables:
- `NODE_ENV`: Set to "production"
- `JWT_SECRET`: Your secret key for JWT tokens
- `PORT`: Railway provides this automatically

Optional variables:
- `LOG_LEVEL`: Logging verbosity (info, warn, error)
- `MAX_FILE_SIZE`: Max upload size in bytes (default: 10MB)

### File Storage
- Files are stored locally in the Railway container
- For persistent storage across deployments, consider:
  - Railway Volumes (for persistent disk)
  - External storage (S3, Cloudflare R2)

## 🧪 Testing the Deployment

1. **Check health endpoint**:
   ```bash
   curl https://your-app.railway.app/health
   ```

2. **Access the application**:
   - Open `https://your-app.railway.app` in your browser
   - The React frontend should load

3. **Test API endpoints**:
   ```bash
   # Test data upload
   curl -X POST https://your-app.railway.app/api/sites/test/data \
     -F "file=@sample-data.csv"
   ```

## 🔄 Updating the Application

### Manual Deployment
```bash
# Make your changes
git add .
git commit -m "Update application"

# Deploy to Railway
railway up
```

### Automatic Deployment (Recommended)
1. Connect Railway to your GitHub repository:
   - Go to Railway dashboard
   - Settings → GitHub
   - Connect your repository
   - Select branch (main/master)

2. Now every push to GitHub automatically deploys!

## 📊 Monitoring

### Logs
View logs in Railway dashboard or CLI:
```bash
railway logs
```

### Metrics
Railway provides:
- CPU usage
- Memory usage
- Network traffic
- Response times

### Health Checks
Railway automatically monitors `/health` endpoint

## 🐛 Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Ensure all dependencies are in package.json
   - Review build logs: `railway logs --build`

2. **Frontend Not Loading**
   - Verify `NODE_ENV=production` is set
   - Check that frontend build completed
   - Look for 404 errors in logs

3. **API Errors**
   - Check environment variables are set
   - Verify JWT_SECRET is configured
   - Review API logs for errors

4. **File Upload Issues**
   - Default limit is 10MB
   - Check available disk space
   - Consider external storage for large files

### Debug Mode
Enable detailed logging:
```bash
railway variables set LOG_LEVEL=debug
```

## 💰 Cost Optimization

### Railway Pricing
- **Hobby Plan**: $5/month (recommended)
  - 8GB RAM
  - Unlimited projects
  - Custom domains

### Tips to Minimize Costs
1. Use efficient caching for static assets
2. Optimize bundle sizes
3. Implement request rate limiting
4. Monitor resource usage regularly

## 🔒 Security Considerations

### Production Checklist
- [ ] Strong JWT_SECRET (32+ characters)
- [ ] HTTPS enabled (Railway provides automatically)
- [ ] Rate limiting configured
- [ ] File upload restrictions
- [ ] Environment variables secured
- [ ] No sensitive data in logs

### Additional Security
```javascript
// Add to backend/src/index.ts for extra security
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}))
```

## 🎯 Performance Optimization

### Backend Optimization
- Compression enabled ✓
- Static file caching ✓
- Efficient routing ✓

### Frontend Optimization
- Code splitting (if needed)
- Image optimization
- Lazy loading for large components

### Caching Strategy
Static assets are cached for 1 day:
- JavaScript/CSS files: 1 day
- Images: 1 day  
- HTML: No cache (always fresh)

## 📚 Additional Resources

- Railway Documentation: https://docs.railway.app
- Railway CLI Reference: https://docs.railway.app/reference/cli-api
- Community Support: https://discord.gg/railway
- Status Page: https://status.railway.app

## 🎉 Success!

Your GHG Monitor is now deployed on Railway! Access it at your Railway-provided URL.

For ongoing development:
1. Make changes locally
2. Test thoroughly
3. Push to GitHub (if connected) or run `railway up`
4. Changes deploy automatically!

Remember to monitor your application regularly and keep dependencies updated.