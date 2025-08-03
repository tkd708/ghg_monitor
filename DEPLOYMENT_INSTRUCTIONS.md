# GHG Monitor - Deployment Instructions

This guide walks you through deploying the GHG Monitor application to production using Railway (single deployment for both frontend and backend).

> **Note**: For the original Vercel + Railway deployment strategy, see the git history. This document now focuses on the simpler Railway-only deployment.

## 🚀 Quick Deployment

### Prerequisites
- Vercel account (https://vercel.com)
- Railway account (https://railway.app)
- GitHub repository with your code

### Backend Deployment (Railway)

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Create and deploy the backend**:
   ```bash
   # From the root directory
   railway create ghg-monitor-backend
   railway up
   ```

4. **Set environment variables** in Railway dashboard:
   - `NODE_ENV=production`
   - `PORT=3000`
   - `JWT_SECRET=your-super-secure-jwt-secret-here`
   - `CORS_ORIGIN=https://your-frontend-domain.vercel.app`

5. **Note your Railway backend URL** (e.g., `https://ghg-monitor-backend.railway.app`)

### Frontend Deployment (Vercel)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from the frontend directory**:
   ```bash
   cd frontend
   vercel
   ```

4. **Configure project settings**:
   - Project name: `ghg-monitor-frontend`
   - Framework: Vite
   - Build command: `npm run build`
   - Output directory: `dist`

5. **Set environment variables** in Vercel dashboard:
   - `VITE_API_URL=https://your-backend-domain.railway.app`

6. **Deploy to production**:
   ```bash
   vercel --prod
   ```

## 🔧 Detailed Configuration

### Backend Environment Variables

Create a `.env` file in the `backend` directory with these variables:

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://your-frontend-domain.vercel.app
JWT_SECRET=your-super-secure-jwt-secret-here-change-this-in-production
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
HELMET_ENABLED=true
```

### Frontend Environment Variables

The frontend uses these environment variables:

```env
VITE_API_URL=https://your-backend-domain.railway.app
```

## 🌐 Domain Configuration

### Custom Domains (Optional)

1. **Backend (Railway)**:
   - Go to Railway dashboard > Your project > Settings > Domains
   - Add your custom domain
   - Update DNS records as instructed

2. **Frontend (Vercel)**:
   - Go to Vercel dashboard > Your project > Settings > Domains
   - Add your custom domain
   - Update DNS records as instructed

## 🔒 Security Considerations

### Environment Variables
- **Never commit `.env` files** to version control
- Use strong, unique JWT secrets
- Set appropriate CORS origins
- Use HTTPS in production

### API Security
- The backend includes rate limiting
- JWT authentication for protected routes
- File upload size limits
- CORS protection

## 🧪 Testing Deployment

### Health Checks

1. **Backend health check**:
   ```bash
   curl https://your-backend-domain.railway.app/health
   ```

2. **Frontend accessibility**:
   Visit `https://your-frontend-domain.vercel.app`

### API Testing

Test key endpoints:
```bash
# Test data upload
curl -X POST https://your-backend-domain.railway.app/api/sites/test-site/data \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample-data.csv"

# Test flux calculations
curl https://your-backend-domain.railway.app/api/sites/test-site/flux-data
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**:
   - Ensure `CORS_ORIGIN` is set correctly in backend
   - Check that frontend URL matches exactly

2. **Build Failures**:
   - Check Node.js version compatibility
   - Ensure all dependencies are installed
   - Review build logs for specific errors

3. **Environment Variables Not Working**:
   - Verify variables are set in deployment platform
   - Check variable names match exactly
   - Redeploy after setting variables

### Deployment Logs

- **Railway**: View logs in Railway dashboard
- **Vercel**: View logs in Vercel dashboard or CLI

### Support Resources

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Project Issues: https://github.com/tkd708/ghg_monitor/issues

## 📊 Monitoring

### Production Monitoring

1. **Railway Dashboard**: Monitor backend performance, logs, and metrics
2. **Vercel Analytics**: Monitor frontend performance and usage
3. **Health Checks**: Set up monitoring for `/health` endpoint

### Performance Optimization

- Enable gzip compression
- Configure caching headers
- Monitor bundle sizes
- Set up CDN for static assets

## 🔄 Continuous Deployment

The project includes GitHub Actions CI/CD pipeline that:
- Runs tests on push/PR
- Builds and deploys on merge to main
- Performs security audits
- Manages Docker containers

To enable auto-deployment:
1. Set up GitHub Actions secrets for deployment
2. Configure webhook triggers
3. Test the pipeline with a sample commit

## 📈 Scaling Considerations

### Backend Scaling
- Railway auto-scales based on usage
- Consider database integration for persistent storage
- Implement caching for frequent calculations

### Frontend Scaling
- Vercel provides global CDN automatically
- Consider code splitting for large applications
- Optimize bundle sizes for better performance

---

🎉 **Congratulations!** Your GHG Monitor application is now deployed and accessible online!

For updates and maintenance, simply push changes to your GitHub repository and the CI/CD pipeline will handle deployment automatically.