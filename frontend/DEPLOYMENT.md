# Deployment Guide

Complete guide for deploying the Cooperative Management System frontend to production.

## Pre-Deployment Checklist

- [ ] Backend API is deployed and accessible
- [ ] HTTPS is enabled on backend
- [ ] CORS is configured for production domain
- [ ] Environment variables are set
- [ ] Database migrations are complete
- [ ] Admin user accounts are created

## Deployment Options

### Option 1: Vercel (Recommended) 🚀

Vercel offers zero-config deployment for Vite apps.

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

**Configuration:**
1. Update `src/api.js` with production API URL
2. Add environment variable in Vercel dashboard:
   - Key: `VITE_API_URL`
   - Value: `https://your-backend-api.com`

### Option 2: Netlify 🌐

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

**Configuration:**
Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Option 3: Traditional Server (Nginx) 🖥️

#### Step 1: Build Production Bundle
```bash
npm run build
```

#### Step 2: Upload `dist/` folder to server
```bash
scp -r dist/* user@your-server:/var/www/cooperative-cms/
```

#### Step 3: Configure Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/cooperative-cms;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # React Router support
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Step 4: Enable HTTPS with Let's Encrypt
```bash
sudo certbot --nginx -d your-domain.com
```

### Option 4: Docker 🐳

#### Dockerfile
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### nginx.conf
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Build and Run
```bash
# Build image
docker build -t cooperative-cms-frontend .

# Run container
docker run -d -p 80:80 cooperative-cms-frontend
```

## Environment Configuration

### Development
```javascript
// src/api.js
const API_BASE = 'http://localhost:8000';
```

### Production
```javascript
// src/api.js
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.your-domain.com';
```

Create `.env.production`:
```env
VITE_API_URL=https://api.your-domain.com
```

## Backend CORS Configuration

Update your FastAPI backend to allow production domain:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Development
        "https://your-domain.com",  # Production
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Performance Optimization

### 1. Code Splitting
Already handled by Vite - each route is lazy-loaded.

### 2. Asset Optimization
```bash
# Install image optimization plugin
npm install -D vite-plugin-imagemin

# Update vite.config.js
import viteImagemin from 'vite-plugin-imagemin';

export default {
  plugins: [
    react(),
    viteImagemin({
      gifsicle: { optimizationLevel: 7 },
      optipng: { optimizationLevel: 7 },
      mozjpeg: { quality: 80 },
      svgo: { plugins: [{ removeViewBox: false }] },
    }),
  ],
};
```

### 3. CDN for Static Assets
Upload `dist/assets/*` to CDN and update `index.html`:
```html
<script src="https://cdn.your-domain.com/assets/index.js"></script>
```

### 4. Service Worker (Optional)
Add PWA support with Vite PWA plugin:
```bash
npm install -D vite-plugin-pwa
```

## Monitoring & Analytics

### 1. Error Tracking (Sentry)
```bash
npm install @sentry/react
```

```javascript
// src/main.jsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: import.meta.env.MODE,
});
```

### 2. Analytics (Google Analytics)
```html
<!-- In index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## Security Hardening

### 1. Content Security Policy
Add to `index.html`:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.your-domain.com;
  img-src 'self' data:;
">
```

### 2. Environment Variables
Never commit sensitive data. Use `.env.production` (gitignored):
```env
VITE_API_URL=https://api.production.com
VITE_SENTRY_DSN=https://...
```

### 3. Rate Limiting
Already handled by backend, but add client-side debouncing:
- Search: 300ms debounce ✅
- Form submissions: Disable button during loading ✅

## Post-Deployment Verification

### Smoke Tests
```bash
# Check homepage loads
curl https://your-domain.com

# Check API connectivity
curl https://your-domain.com/api/health

# Test login flow
# (Manual test in browser)
```

### Performance Checks
- Lighthouse score > 90 (run in Chrome DevTools)
- Time to Interactive < 3s
- First Contentful Paint < 1.5s

### Browser Testing
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers

## Rollback Strategy

If deployment fails:

### Vercel/Netlify
```bash
# Rollback to previous deployment
vercel rollback
# or
netlify rollback
```

### Traditional Server
```bash
# Keep backup of previous build
cp -r /var/www/cooperative-cms /var/www/cooperative-cms.backup

# Rollback
rm -rf /var/www/cooperative-cms
mv /var/www/cooperative-cms.backup /var/www/cooperative-cms
```

## Continuous Deployment (CI/CD)

### GitHub Actions Example
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.API_URL }}
      
      - name: Deploy to Vercel
        run: vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## Maintenance

### Regular Tasks
- Update dependencies monthly: `npm update`
- Review security advisories: `npm audit`
- Monitor error logs in Sentry
- Check performance metrics
- Backup user data regularly

### Scaling Considerations
- Use CDN for static assets
- Enable HTTP/2 on server
- Implement service worker for offline support
- Add Redis caching on backend
- Set up load balancing for high traffic

## Support Contacts

- Frontend Issues: [Your GitHub Issues]
- Backend API: [Backend Team]
- Infrastructure: [DevOps Team]
- Security: [Security Team]

---

🎉 **Deployment Complete!**

Your Cooperative Management System is now live and serving users.
