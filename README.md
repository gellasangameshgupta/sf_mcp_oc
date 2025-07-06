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
- **CaseId__c** - Links return orders to support cases
- **LabelEmailSent__c** - Tracks if return label was emailed
- **LabelEmailSentDate__c** - Timestamp of label email

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

## 🔧 Deployment Options

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

### Test MCP Tools
Use the test files provided:
- `test-mcp.js` - Local MCP testing
- `test-railway-mcp.js` - Railway deployment testing
- `postman-collection.json` - API testing collection

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

## 📁 Project Structure

```
sf_mcp_oc/
├── package.xml                    # Deployment manifest
├── sfdx-project.json             # Salesforce DX project config
├── force-app/main/default/       # Salesforce metadata
│   ├── objects/ReturnOrder/fields/ # Custom fields
│   └── flows/                     # Flow automation
├── src/                          # MCP server source code
│   ├── index.ts                  # Main server implementation
│   ├── salesforce-client.ts     # Salesforce API integration
│   └── types.ts                  # TypeScript types and schemas
├── dist/                         # Compiled JavaScript
└── test-*.js                     # Testing utilities
```

## 🌟 Benefits of Standard Objects

- **Native Salesforce Support** - Official support and automatic updates
- **Better Performance** - Optimized for large data volumes  
- **Standard Integration** - Works with other Salesforce products
- **Mobile Ready** - Native mobile app support
- **Future Proof** - Automatic platform updates
- **Reporting** - Built-in analytics and standard reports

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
- **Custom business logic**: Modify flows and validation rules as needed

---

**Note**: This implementation uses Salesforce standard objects (ReturnOrder/ReturnOrderLineItem) instead of custom objects, providing better long-term maintainability and platform integration.