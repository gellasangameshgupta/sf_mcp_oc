# Netlify Deployment Guide

This guide explains how to deploy the Salesforce Order Concierge MCP Server to Netlify Functions.

## 🚀 Quick Deployment

### Option 1: Deploy from Git Repository

1. **Push to GitHub/GitLab/Bitbucket:**
   ```bash
   git add .
   git commit -m "Add Netlify configuration"
   git push origin main
   ```

2. **Connect to Netlify:**
   - Go to [Netlify Dashboard](https://app.netlify.com)
   - Click "New site from Git"
   - Connect your Git repository
   - Netlify will auto-detect the configuration from `netlify.toml`

### Option 2: Manual Deploy

1. **Build locally:**
   ```bash
   npm install
   npm run build:netlify
   ```

2. **Deploy with Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod
   ```

## ⚙️ Environment Variables

Set these in your Netlify Dashboard under Site Settings → Environment Variables:

### Required Salesforce Variables:
- `SF_USERNAME` - Your Salesforce username
- `SF_PASSWORD` - Your Salesforce password  
- `SF_SECURITY_TOKEN` - Your Salesforce security token
- `SF_LOGIN_URL` - Salesforce login URL (default: your-sf-login-url)

### Optional Salesforce OAuth Variables:
- `SF_CLIENT_ID` - Connected app client ID
- `SF_CLIENT_SECRET` - Connected app client secret

### Slack Integration:
- `SLACK_WEBHOOK_URL` - Your Slack webhook URL

## 📡 API Endpoints

Once deployed, your endpoints will be available at:

- **Health Check:** `https://your-site.netlify.app/health`
- **List Tools:** `https://your-site.netlify.app/mcp/tools/list` (POST)
- **Execute Tool:** `https://your-site.netlify.app/mcp/tools/call` (POST)

## 🧪 Testing Your Deployment

### Test Health Check:
```bash
curl https://your-site.netlify.app/health
```

### Test Tools List:
```bash
curl -X POST https://your-site.netlify.app/mcp/tools/list \
  -H "Content-Type: application/json"
```

### Test Slack Alert:
```bash
curl -X POST https://your-site.netlify.app/mcp/tools/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "send_slack_alert",
    "arguments": {
      "message": "Test deployment successful!",
      "priority": "info"
    }
  }'
```

## 🔧 Local Development

To test Netlify Functions locally:

```bash
# Install dependencies
npm install

# Start Netlify dev server
npm run netlify:dev
```

This will start a local server at `http://localhost:8888` that simulates the Netlify environment.

## 📁 Project Structure

```
├── netlify/
│   └── functions/          # Netlify Functions
│       ├── health.ts       # Health check endpoint
│       ├── tools-list.ts   # Tools list endpoint
│       └── tools-call.ts   # Tool execution endpoint
├── public/                 # Static files
│   └── index.html         # Landing page
├── src/                   # Source code (shared)
├── netlify.toml          # Netlify configuration
└── package.json          # Dependencies & scripts
```

## ⚠️ Important Notes

1. **Serverless Functions:** Each API call is a separate function invocation
2. **Cold Starts:** First request may be slower due to Salesforce connection
3. **Timeouts:** Netlify functions have a 10-second timeout limit
4. **CORS:** All endpoints include CORS headers for web browser access

## 🛠️ Troubleshooting

### Common Issues:

1. **Build Failures:**
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compiles without errors: `npm run typecheck`

2. **Salesforce Connection Issues:**
   - Verify environment variables are set correctly
   - Check Salesforce credentials and security token
   - Test connection locally first

3. **Slack Integration Issues:**
   - Verify `SLACK_WEBHOOK_URL` is correct
   - Test webhook URL directly with curl

### Debug Steps:

1. Check Netlify function logs in your dashboard
2. Test endpoints locally with `netlify dev`
3. Verify environment variables are accessible in functions

## 🔄 Updates

To update your deployment:

```bash
git add .
git commit -m "Update application"
git push origin main
```

Netlify will automatically rebuild and deploy your changes.

## 📊 Monitoring

- **Function Logs:** Available in Netlify Dashboard → Functions tab
- **Analytics:** Monitor usage and performance in Netlify Dashboard
- **Alerts:** Set up notifications for deployment failures or high error rates

## 💡 Tips

1. **Performance:** Consider using Netlify's Edge Functions for faster response times
2. **Security:** Use Netlify's environment variable encryption for sensitive data
3. **Scaling:** Netlify Functions automatically scale based on traffic
4. **Custom Domain:** Add your own domain in Site Settings → Domain Management