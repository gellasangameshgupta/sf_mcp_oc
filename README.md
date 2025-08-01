# Salesforce Order Concierge MCP Server

A Model Context Protocol (MCP) server that provides Salesforce order management capabilities for Claude Desktop, including order status checking, return creation, case management, and Slack notifications.

## 🎯 Overview

This MCP server enables Claude Desktop to interact with Salesforce for:

- **Order status checking** with shipping details and tracking information
- **Return order creation** using standard Salesforce ReturnOrder objects  
- **Case management integration** for customer service escalation
- **Slack notification system** for real-time alerts
- **Return label email automation** for customer convenience

## 🛠 Available Tools

1. **`check_order_status`** - Check order status, shipping details, and tracking information
2. **`create_return`** - Create return orders using standard Salesforce objects
3. **`email_return_label`** - Email return shipping labels to customers
4. **`update_case_status`** - Update case status with priority and assignment changes
5. **`create_case_from_return`** - Create support cases from return orders
6. **`send_slack_alert`** - Send formatted alerts to Slack channels

## 🚀 Quick Setup

### 1. Install Dependencies and Build

```bash
npm install
npm run build
```

### 2. Deploy Salesforce Metadata (Optional)

If you want to use the enhanced features:

```bash
# Authenticate to your Salesforce org
sf org login web --alias MyOrg

# Deploy custom fields and flows
sf project deploy start --target-org MyOrg
```

### 3. Configure Claude Desktop

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "salesforce-order-concierge": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/path/to/sf_mcp_oc",
      "env": {
        "SF_LOGIN_URL": "https://login.salesforce.com",
        "SF_USERNAME": "your-salesforce-username@example.com",
        "SF_PASSWORD": "your-salesforce-password",
        "SF_SECURITY_TOKEN": "your-salesforce-security-token",
        "SLACK_WEBHOOK_URL": "your-slack-webhook-url-optional"
      }
    }
  }
}
```

### 4. Restart Claude Desktop

After adding the configuration, restart Claude Desktop to load the MCP server.

## 🔍 Testing with MCP Inspector

The MCP Inspector is a powerful tool for testing and debugging MCP servers. Here's how to use it:

### Install MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

### Test Your Server

1. **Start the Inspector:**
   ```bash
   npx @modelcontextprotocol/inspector
   ```

2. **Configure Connection:**
   - **Server Command:** `node`
   - **Arguments:** `["dist/index.js"]`
   - **Working Directory:** `/path/to/sf_mcp_oc`
   - **Environment Variables:**
     ```
     SF_LOGIN_URL=https://login.salesforce.com
     SF_USERNAME=your-username@example.com
     SF_PASSWORD=your-password
     SF_SECURITY_TOKEN=your-token
     SLACK_WEBHOOK_URL=your-webhook-url
     ```

3. **Test Tools:**
   - Click "Connect" to establish connection
   - Browse available tools in the left panel
   - Test each tool with sample data
   - View requests/responses in real-time

### Sample Test Data

**Check Order Status:**
```json
{
  "orderId": "00000100"
}
```

**Create Return:**
```json
{
  "orderId": "801xx0000000001",
  "lineItemId": "802xx0000000001",
  "reason": "Defective",
  "quantity": 1,
  "description": "Product stopped working"
}
```

**Send Slack Alert:**
```json
{
  "message": "Test alert from MCP Inspector",
  "priority": "info"
}
```

### Debugging Tips

- **Connection Issues:** Check environment variables and Salesforce credentials
- **Tool Failures:** Review error messages in the inspector's response panel
- **Permissions:** Ensure your Salesforce user has access to required objects
- **Network:** Verify Salesforce and Slack connectivity

## 📋 Prerequisites

### Salesforce Requirements
- Salesforce org with Service Cloud or Field Service license
- Order Management enabled
- API access for the configured user
- Standard objects: Order, OrderItem, ReturnOrder, ReturnOrderLineItem, Case

### System Requirements
- Node.js 18+ installed
- Salesforce CLI (optional, for metadata deployment)
- Claude Desktop application

## 🔧 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SF_LOGIN_URL` | Yes | Salesforce login URL (`https://login.salesforce.com` for production, `https://test.salesforce.com` for sandbox) |
| `SF_USERNAME` | Yes | Salesforce username |
| `SF_PASSWORD` | Yes | Salesforce password |
| `SF_SECURITY_TOKEN` | Yes | Salesforce security token |
| `SLACK_WEBHOOK_URL` | No | Slack webhook URL for notifications |

## 🏗 Salesforce Objects Used

### Standard Objects
- **ReturnOrder** - Standard Salesforce object for return management
- **ReturnOrderLineItem** - Individual return items
- **Case** - Customer service integration
- **Order/OrderItem** - Order relationships

### Custom Fields (Optional)
- **ReturnOrder.LabelEmailSent__c** - Tracks if return label was emailed
- **ReturnOrder.LabelEmailSentDate__c** - Email timestamp

## 🚨 Troubleshooting

### Common Issues

1. **"Server disconnected while setting up"**
   ```bash
   # Check if server builds successfully
   npm run build
   
   # Verify file permissions
   chmod +x dist/index.js
   
   # Test server startup
   node dist/index.js
   ```

2. **"Invalid login"**  
   - Verify Salesforce credentials
   - Check security token (get new one from Setup → My Personal Information)
   - Use correct login URL for your org type

3. **"Object not found" errors**
   - Ensure Service Cloud license is active
   - Enable Order Management in Setup → Sales → Order Settings
   - Verify user has access to ReturnOrder objects

4. **Tool execution failures**
   - Test with MCP Inspector to see detailed error messages
   - Check Salesforce debug logs
   - Verify required fields are populated

### Getting Help

- Use MCP Inspector for detailed debugging
- Check Claude Desktop logs for connection issues
- Review Salesforce debug logs for API errors
- Test Salesforce connectivity with simple SOQL queries

## 📁 Project Structure

```
sf_mcp_oc/
├── src/
│   ├── index.ts                  # Main MCP server
│   ├── salesforce-client.ts     # Salesforce API client
│   └── types.ts                  # TypeScript schemas
├── force-app/main/default/       # Salesforce metadata
│   ├── objects/ReturnOrder/      # Custom fields
│   └── flows/                    # Automation flows
├── dist/                         # Compiled JavaScript
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript config
└── CLAUDE.md                     # Project instructions
```

## 🔒 Security

- Never commit credentials to version control
- Use environment variables for all sensitive data
- Rotate Salesforce security tokens regularly
- Use dedicated API users with minimal required permissions

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Claude Desktop Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Salesforce ReturnOrder Documentation](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_returnorder.htm)