# Salesforce Order Concierge MCP Server

This MCP server provides Salesforce order management capabilities including order status checking, return creation, case management, and Slack notifications.

## Setup for Claude Desktop

### 1. Build the Project
```bash
npm install
npm run build
```

### 2. Configure Environment Variables
Update the environment variables in your MCP server configuration:

- `SF_LOGIN_URL`: Your Salesforce login URL (https://login.salesforce.com for production, https://test.salesforce.com for sandbox)
- `SF_USERNAME`: Your Salesforce username
- `SF_PASSWORD`: Your Salesforce password
- `SF_SECURITY_TOKEN`: Your Salesforce security token
- `SLACK_WEBHOOK_URL`: (Optional) Your Slack webhook URL for notifications

### 3. Add to Claude Desktop Configuration

Add this configuration to your Claude Desktop `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
    "salesforce-order-concierge": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/Users/gellasangamesh/Downloads/Manual Library/Coding/Salesforce/sf_mcp_oc",
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

## Available Tools

- **check_order_status**: Check Salesforce order details by order ID or number
- **create_return**: Create return order requests with auto-detection of line items
- **email_return_label**: Email return shipping labels to customers
- **create_case_from_return**: Create support cases from return orders
- **update_case_status**: Update support case status and assignments
- **send_slack_alert**: Send notifications to Slack channels

## Usage Examples

### Check Order Status
```
Check the status of order 00000100
```

### Create Return
```
Create a return for order 00000100 due to defective product
```

### Email Return Label
```
Email return label for return order 0OR5x0000000001 to customer@example.com
```

### Create Case from Return
```
Create a case from return order 0OR5x0000000001
```

### Update Case Status
```
Update case 500xx0000000001 status to Working with high priority
```

### Send Slack Alert
```
Send an error priority Slack alert about urgent case 500xx0000000001
```

## Configuration Notes

- Make sure your Salesforce credentials have appropriate permissions for order, return, and case management
- The server uses OAuth 2.0 client credentials flow for authentication
- All order IDs support both Salesforce IDs and order numbers
- Return creation automatically detects line items when using AUTO_DETECT