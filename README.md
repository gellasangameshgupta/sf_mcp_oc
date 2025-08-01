# Salesforce Order Concierge MCP Server

A comprehensive Model Context Protocol (MCP) server that provides white-glove ecommerce assistant capabilities for Salesforce. This server enables Claude Desktop to interact with Salesforce orders, returns, and customer service operations using **standard Salesforce objects**.

## 🎯 Overview

The Order Concierge acts as a sophisticated customer service assistant that integrates with Salesforce's standard **ReturnOrder** and **ReturnOrderLineItem** objects, providing:

- **Order status checking** with shipping details and tracking information
- **Return order creation** using standard Salesforce objects  
- **Case management integration** for customer service escalation
- **Slack notification system** for real-time alerts
- **Return label email automation** for customer convenience
- **Flow-based automation** for modern Salesforce workflows

## 🛠 MCP Server Capabilities

### Available Tools

1. **`check_order_status`**
   - Retrieves order status, shipping carrier, tracking number, and ETA
   - Shows shipping address information
   - Input: `orderId` (Order ID or Order Number)

2. **`create_return`**
   - Creates ReturnOrder and ReturnOrderLineItem records using standard objects
   - Validates quantity against original order
   - Inputs: `orderId`, `lineItemId`, `reason`, `quantity`, `description` (optional)
   - Returns: ReturnOrder ID for tracking

3. **`email_return_label`**
   - Sends PDF return shipping labels to customer email
   - Only works for approved return orders
   - Inputs: `returnOrderId`, `customerEmail`
   - Tracks email sent status and timestamp

4. **`update_case_status`**
   - Updates case status with validation and audit trail
   - Supports case assignment and priority changes  
   - Inputs: `caseId`, `status`, `reason`, `priority`, `assignedTo`
   - Sends automatic Slack notifications

5. **`create_case_from_return`**
   - Creates support cases from return orders
   - Includes return details and line item information
   - Input: `returnOrderId`
   - Returns: Case ID for tracking

6. **`send_slack_alert`**
   - Sends formatted alerts to Slack channels
   - Priority-based formatting and icons
   - Inputs: `message`, `channel`, `priority`, `caseId`, `customFields`

## 🏗 Salesforce Architecture

### Standard Objects Used

- **ReturnOrder** - Standard Salesforce object for return management
- **ReturnOrderLineItem** - Standard object for individual return items
- **Case** - Standard object for customer service integration
- **Order/OrderItem** - Standard objects for order relationships

### Custom Enhancements

#### Custom Fields on ReturnOrder
- **LabelEmailSent__c** - Tracks if return label was emailed
- **LabelEmailSentDate__c** - Timestamp of label email

#### Standard Fields Used
- **CaseId** - Standard field linking return orders to support cases

#### Flow Automation
- **ReturnOrder_Label_Email_Management** - Manages email timestamp automation
- **ReturnOrder_Status_Change_Notifications** - Logs status changes as audit tasks

## 🚀 Quick Start

### Prerequisites

1. **Salesforce CLI** installed
   ```bash
   npm install -g @salesforce/cli
   sf --version
   ```

2. **Salesforce Org Requirements:**
   - Service Cloud or Field Service license
   - Order Management enabled
   - Admin access for deployment

### 1. Deploy Salesforce Metadata

```bash
# Navigate to project directory
cd /path/to/sf_mcp_oc

# Authenticate to your org
sf org login web --alias MyOrg

# Deploy metadata
sf project deploy start --target-org MyOrg

# Alternative: deploy via manifest
sf project deploy start --manifest package.xml --target-org MyOrg
```

### 2. Configure Permissions

Since this deployment doesn't include a permission set, configure permissions manually:

**Option A: Via Profiles**
1. Setup → Profiles → Edit relevant profiles
2. Object Settings → Return Order: Enable Read, Create, Edit, Delete
3. Object Settings → Return Order Line Item: Enable Read, Create, Edit, Delete

**Option B: Create Custom Permission Set**
1. Setup → Permission Sets → New
2. Add object permissions for ReturnOrder and ReturnOrderLineItem
3. Add field permissions for custom fields
4. Assign to users

### 3. Configure MCP Server

#### Environment Variables
```bash
SF_LOGIN_URL=https://login.salesforce.com
SF_USERNAME=your-username
SF_PASSWORD=your-password
SF_SECURITY_TOKEN=your-security-token
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_DEFAULT_CHANNEL=#returns
```

#### Claude Desktop Configuration
Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "salesforce-order-concierge": {
      "command": "node",
      "args": ["/path/to/sf_mcp_oc/dist/index.js"],
      "env": {
        "SF_LOGIN_URL": "https://login.salesforce.com",
        "SF_USERNAME": "your-username",
        "SF_PASSWORD": "your-password",
        "SF_SECURITY_TOKEN": "your-token"
      }
    }
  }
}
```

### 4. Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Test locally
node dist/index.js
```

## 🌐 Netlify Deployment

### Quick Deployment Options

#### Option 1: Git-based Deployment (Recommended)
1. **Push to GitHub/GitLab/Bitbucket:**
   ```bash
   git add .
   git commit -m "Deploy to Netlify"
   git push origin main
   ```

2. **Connect to Netlify:**
   - Go to [Netlify Dashboard](https://app.netlify.com)
   - Click "New site from Git"
   - Connect your Git repository
   - Netlify will auto-detect configuration from `netlify.toml`

#### Option 2: Manual Deploy
```bash
# Build for Netlify
npm install
npm run build:netlify

# Deploy with Netlify CLI
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

### Environment Variables for Netlify

Set these in your Netlify Dashboard under Site Settings → Environment Variables:

#### Required Salesforce Variables:
- `SF_USERNAME` - Your Salesforce username
- `SF_PASSWORD` - Your Salesforce password  
- `SF_SECURITY_TOKEN` - Your Salesforce security token
- `SF_LOGIN_URL` - Salesforce login URL (default: https://login.salesforce.com)

#### Optional Salesforce OAuth Variables:
- `SF_CLIENT_ID` - Connected app client ID
- `SF_CLIENT_SECRET` - Connected app client secret

#### Slack Integration:
- `SLACK_WEBHOOK_URL` - Your Slack webhook URL

### Netlify API Endpoints

Once deployed, your endpoints will be available at:
- **Health Check:** `https://your-site.netlify.app/health`
- **List Tools:** `https://your-site.netlify.app/mcp/tools/list` (POST)
- **Execute Tool:** `https://your-site.netlify.app/mcp/tools/call` (POST)

### Testing Netlify Deployment

```bash
# Test health check
curl https://your-site.netlify.app/health

# Test tools list
curl -X POST https://your-site.netlify.app/mcp/tools/list \
  -H "Content-Type: application/json"

# Test Slack alert
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

### Local Netlify Development

```bash
# Install dependencies
npm install

# Start Netlify dev server
npm run netlify:dev
```

This starts a local server at `http://localhost:8888` that simulates the Netlify environment.

## 🔧 Alternative Deployment Options

### Option 1: Modern Salesforce CLI (Recommended)
```bash
sf org login web --alias MyOrg
sf project deploy start --target-org MyOrg
```

### Option 2: Legacy CLI
```bash
sfdx auth:web:login -a MyOrg
sfdx force:source:deploy -x package.xml -u MyOrg
```

### Option 3: Workbench
1. Go to [Workbench](https://workbench.developerforce.com/)
2. Navigate to Migration → Deploy
3. Upload `force-app` folder as ZIP
4. Deploy with rollback enabled

## 📊 Standard Object Details

### ReturnOrder Standard Fields
- **ReturnOrderNumber** - Auto-generated return number
- **OrderId** - Lookup to original Order
- **AccountId** - Lookup to Account  
- **Status** - Draft, Submitted, Approved, Cancelled, Partially Fulfilled, Fulfilled
- **ReturnOrderDate** - Date of return request
- **Description** - Return description
- **TotalAmount** - Total return amount

### ReturnOrderLineItem Standard Fields  
- **ReturnOrderId** - Master-detail to ReturnOrder
- **OrderItemId** - Lookup to original OrderItem
- **Product2Id** - Lookup to Product
- **Quantity** - Quantity to return
- **ReasonCode** - Return reason (Defective, Damaged, Wrong Item, etc.)
- **UnitPrice/TotalPrice** - Pricing information

## 🎛 Tool Examples

### Create Return
```javascript
{
  "orderId": "801xx0000000001",
  "lineItemId": "802xx0000000001", 
  "reason": "Defective",
  "quantity": 1,
  "description": "Product stopped working after 2 days"
}
```

### Email Return Label
```javascript
{
  "returnOrderId": "0OR5x0000000001",
  "customerEmail": "customer@example.com"
}
```

### Update Case Status
```javascript
{
  "caseId": "500xx0000000001",
  "status": "Working",
  "reason": "Investigating return request",
  "priority": "High"
}
```

## 🔍 Testing

### Verify Object Access
```sql
-- Test ReturnOrder access
SELECT Id, ReturnOrderNumber, Status FROM ReturnOrder LIMIT 1

-- Test ReturnOrderLineItem access  
SELECT Id, Quantity, ReasonCode FROM ReturnOrderLineItem LIMIT 1
```

### Test with Postman Collection
Use the included `postman-collection.json` for comprehensive API testing.

## 🚨 Troubleshooting

### Common Issues

1. **"ReturnOrder object not found"**
   - Verify Service Cloud or Field Service license
   - Enable Order Management: Setup → Sales → Order Settings
   - Check user permissions for standard objects

2. **"Insufficient Privileges" errors**
   - Configure object permissions via Profiles or Permission Sets
   - Verify CRUD permissions on ReturnOrder/ReturnOrderLineItem
   - Check field-level security for custom fields

3. **MCP Server Connection Issues**
   - Verify environment variables are correctly set
   - Check Salesforce API user permissions
   - Ensure custom fields are accessible via API

4. **Flow Automation Not Working**
   - Verify flows are active in Setup → Flows
   - Check flow trigger conditions
   - Ensure custom fields exist and are accessible

5. **Slack Notifications Failing**
   - Verify SLACK_WEBHOOK_URL format
   - Check Slack channel permissions
   - Review server logs for detailed errors

### Netlify-Specific Troubleshooting

1. **Build Failures:**
   - Check that all dependencies are in `package.json`
   - Ensure TypeScript compiles without errors: `npm run typecheck`

2. **Salesforce Connection Issues:**
   - Verify environment variables are set correctly in Netlify Dashboard
   - Check Salesforce credentials and security token
   - Test connection locally first

3. **Function Timeouts:**
   - Netlify functions have a 10-second timeout limit
   - Optimize Salesforce queries for better performance

## 📁 Project Structure

```
sf_mcp_oc/
├── package.xml                    # Deployment manifest
├── sfdx-project.json             # Salesforce DX project config
├── netlify.toml                  # Netlify configuration
├── force-app/main/default/       # Salesforce metadata
│   ├── objects/ReturnOrder/fields/ # Custom fields
│   └── flows/                     # Flow automation
├── netlify/functions/            # Netlify serverless functions
│   ├── health.ts                 # Health check endpoint
│   ├── tools-list.ts            # Tools list endpoint
│   └── tools-call.ts            # Tool execution endpoint
├── public/                       # Static site files
│   └── index.html               # Landing page
├── src/                          # MCP server source code
│   ├── index.ts                  # Main server implementation
│   ├── salesforce-client.ts     # Salesforce API integration
│   └── types.ts                  # TypeScript types and schemas
├── dist/                         # Compiled JavaScript
└── postman-collection.json       # API testing collection
```

## 🌟 Benefits

### Standard Objects
- **Native Salesforce Support** - Official support and automatic updates
- **Better Performance** - Optimized for large data volumes  
- **Standard Integration** - Works with other Salesforce products
- **Mobile Ready** - Native mobile app support
- **Future Proof** - Automatic platform updates
- **Reporting** - Built-in analytics and standard reports

### Netlify Deployment
- **Serverless Scaling** - Automatic scaling based on demand
- **Global CDN** - Fast response times worldwide  
- **Zero Server Maintenance** - No server management required
- **Built-in CI/CD** - Automatic deployments from Git
- **Free Tier Available** - Generous free usage limits
- **HTTPS by Default** - Free SSL certificates
- **Easy Custom Domains** - Simple domain configuration

## 🔒 Security Notes

1. **Never commit real secrets** to the repository
2. **Always use environment variables** for sensitive data
3. **Environment files are ignored** by git
4. **Use secure Salesforce connections** with proper authentication

## 📊 Monitoring

### Netlify Monitoring
- **Function Logs:** Available in Netlify Dashboard → Functions tab
- **Analytics:** Monitor usage and performance in Netlify Dashboard
- **Alerts:** Set up notifications for deployment failures or high error rates

### Salesforce Monitoring
- **Setup Audit Trail:** Track configuration changes
- **Login History:** Monitor API access
- **Debug Logs:** Troubleshoot flow automation

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues related to:
- **Salesforce deployment**: Check Salesforce documentation for ReturnOrder
- **MCP server integration**: Review server logs and configuration  
- **Netlify deployment**: Check Netlify function logs and build output
- **Custom business logic**: Modify flows and validation rules as needed

*If you need anything more you can always reach out to me on my socials. You know where to find me*

## 🤖 AI Assistance

This project includes natural language interface and MCP server improvements developed with assistance from [Claude Code](https://claude.ai/code).

**Key AI-Generated Features:**
- Natural language HTML interface for Salesforce operations
- Regex pattern improvements for handling multiple ID formats
- MCP server architecture and implementation
- Netlify Functions integration
- Error handling and validation improvements

Co-Authored-By: Claude <noreply@anthropic.com>

## 🔗 Resources
1. **MCP Official Documentation** - https://modelcontextprotocol.io/docs/getting-started/intro
2. **MCP Official Servers Github** - https://github.com/modelcontextprotocol/servers?tab=readme-ov-file
3. **Official Salesforce MCP** - https://github.com/salesforcecli/mcp
4. **Session Deck** - https://gamma.app/docs/From-Wheres-my-order-to-Instant-Action-sz7i7ulq5vic8pe
---

**Note**: This implementation uses Salesforce standard objects (ReturnOrder/ReturnOrderLineItem) instead of custom objects, providing better long-term maintainability and platform integration. The project includes both local MCP server functionality and Netlify serverless deployment options.
