# Salesforce Order Concierge MCP Server

A Model Context Protocol (MCP) server that provides white-glove ecommerce assistant capabilities for Salesforce. This server enables Claude Desktop to interact with Salesforce orders, returns, and customer service operations.

## 🎯 Purpose

The Order Concierge acts as a sophisticated customer service assistant that can:
- Check order shipping status, carrier information, and delivery estimates
- Create returns (RMA) for individual line items
- Email pre-generated return labels to customers

## 🛠 Capabilities

### Available Tools

1. **`check_order_status`**
   - Retrieves order status, shipping carrier, tracking number, and ETA
   - Shows shipping address information
   - Input: `orderId` (Order ID or Order Number)

2. **`create_return`**
   - Creates return merchandise authorization (RMA) for specific line items
   - Inputs: `orderId`, `lineItemId`, `reason`, `quantity`
   - Returns: Return ID for tracking

3. **`email_return_label`**
   - Sends PDF return shipping labels to customer email
   - Inputs: `returnId`, `customerEmail`
   - Confirms successful delivery

## 📋 Prerequisites

- Node.js 18+ 
- Salesforce org with appropriate permissions
- Claude Desktop application

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or navigate to project directory
cd sf_mcp_oc

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Salesforce Configuration

Create `.env` file with your Salesforce credentials:

```env
SF_LOGIN_URL=https://login.salesforce.com
SF_USERNAME=your-salesforce-username
SF_PASSWORD=your-salesforce-password
SF_SECURITY_TOKEN=your-security-token
```

### 3. Claude Desktop Integration

The server is already configured in Claude Desktop at:
`~/Library/Application Support/Claude/claude_desktop_config.json`

Configuration entry:
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

### 4. Usage

1. **Restart Claude Desktop** to load the MCP server
2. **Test the connection** by asking Claude:
   - "What order management tools do you have?"
   - "Check the status of order 12345"
   - "I need to return an item from my recent order"

## 🏗 Project Structure

```
sf_mcp_oc/
├── src/
│   ├── index.ts              # Main MCP server implementation
│   ├── salesforce-client.ts  # Salesforce API integration
│   └── types.ts              # TypeScript types and Zod schemas
├── dist/                     # Compiled JavaScript output
├── package.json              # Project configuration
├── tsconfig.json             # TypeScript configuration
├── .eslintrc.json           # ESLint configuration
├── .env.example             # Environment variables template
├── test-mcp.js              # MCP server testing script
└── README.md                # This documentation
```

## 🧪 Testing

### Type Check & Build
```bash
npm run typecheck    # Verify TypeScript types
npm run build        # Compile to JavaScript
npm run lint         # Check code style
```

### MCP Server Test
```bash
node test-mcp.js     # Test MCP protocol communication
```

### Manual Testing
```bash
npm start            # Start server directly
```

## 📊 Salesforce Object Model

The server expects these Salesforce objects:

### Standard Objects
- **Order**: Standard Salesforce Order object with shipping fields
- **OrderItem**: Line items with Product2 references

### Custom Objects (Expected)
- **Return__c**: Custom object for RMA tracking
  - `OrderId__c`: Reference to original order
  - `OrderItemId__c`: Reference to returned line item
  - `ProductId__c`: Product being returned
  - `Quantity__c`: Return quantity
  - `Reason__c`: Return reason
  - `Status__c`: Return status
  - `RequestDate__c`: When return was requested

### Required Fields
Orders should have:
- `ShippingCarrier__c` (custom field)
- `TrackingNumber__c` (custom field)  
- `EstimatedDeliveryDate__c` (custom field)
- Standard shipping address fields

## 🔧 Development

### Available Scripts
- `npm run build` - Compile TypeScript
- `npm run dev` - Watch mode development
- `npm start` - Start production server
- `npm run typecheck` - Type checking only
- `npm run lint` - Code linting

### Adding New Tools
1. Define tool schema in `src/index.ts` ListToolsRequestSchema handler
2. Add implementation in CallToolRequestSchema handler
3. Update Salesforce client methods in `src/salesforce-client.ts`
4. Add types/validation in `src/types.ts`

## 🛡 Security Notes

- Credentials are passed via environment variables
- No sensitive data is logged or exposed in responses
- Authentication errors are handled gracefully
- All inputs are validated using Zod schemas

## 🔗 Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [JSForce Library](https://jsforce.github.io/)
- [Salesforce Object Reference](https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/)
- [Claude Desktop MCP Integration](https://docs.anthropic.com/en/docs/claude-code/mcp)

## 📝 Status

✅ **Completed Features:**
- MCP server implementation
- All three core tools (status, returns, email)
- Salesforce integration via jsforce
- Claude Desktop configuration
- TypeScript compilation and validation
- Error handling and input validation

🔄 **Next Steps:**
- Test with real Salesforce data
- Add more sophisticated return workflows
- Implement order modification capabilities
- Add customer notification features

## 🐛 Troubleshooting

**Common Issues:**

1. **"Cannot find namespace 'jsforce'"**
   - Fixed: Using `import * as jsforce` syntax
   - Ensure `@types/jsforce` is installed

2. **"No username password given"**
   - Check `.env` file configuration
   - Verify Salesforce credentials

3. **MCP server not appearing in Claude Desktop**
   - Restart Claude Desktop after configuration changes
   - Check file paths in `claude_desktop_config.json`

4. **Salesforce connection errors**
   - Verify security token is current
   - Check IP restrictions in Salesforce org
   - Ensure user has appropriate permissions

---

Built with ❤️ for seamless Salesforce integration