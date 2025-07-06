#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'http';
import { SalesforceClient } from './salesforce-client.js';
import { ReturnRequestSchema, ReturnLabelRequestSchema, CaseStatusUpdateSchema, SlackAlertSchema } from './types.js';
class OrderConciergeServer {
    server;
    salesforceClient;
    constructor() {
        this.server = new Server({
            name: 'salesforce-order-concierge',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        const config = {
            loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
            username: process.env.SF_USERNAME || '',
            password: process.env.SF_PASSWORD || '',
            securityToken: process.env.SF_SECURITY_TOKEN,
            clientId: process.env.SF_CLIENT_ID,
            clientSecret: process.env.SF_CLIENT_SECRET,
            slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
            slackDefaultChannel: process.env.SLACK_DEFAULT_CHANNEL,
        };
        this.salesforceClient = new SalesforceClient(config);
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'check_order_status',
                        description: 'Check an order\'s shipping status, carrier, tracking number, and ETA',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                orderId: {
                                    type: 'string',
                                    description: 'The order ID or order number to check'
                                }
                            },
                            required: ['orderId']
                        }
                    },
                    {
                        name: 'create_return',
                        description: 'Create a return order for a single line item in an order using standard Salesforce objects',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                orderId: {
                                    type: 'string',
                                    description: 'The order ID containing the item to return'
                                },
                                lineItemId: {
                                    type: 'string',
                                    description: 'The specific line item ID to return'
                                },
                                reason: {
                                    type: 'string',
                                    enum: ['Defective', 'Damaged', 'Wrong Item', 'Not Needed', 'Quality Issue', 'Size/Color', 'Other'],
                                    description: 'Reason for the return'
                                },
                                quantity: {
                                    type: 'number',
                                    description: 'Quantity to return',
                                    minimum: 1
                                },
                                description: {
                                    type: 'string',
                                    description: 'Optional additional description for the return'
                                }
                            },
                            required: ['orderId', 'lineItemId', 'reason', 'quantity']
                        }
                    },
                    {
                        name: 'email_return_label',
                        description: 'Email the customer a PDF return label for an approved return order',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                returnOrderId: {
                                    type: 'string',
                                    description: 'The return order ID for which to send the label'
                                },
                                customerEmail: {
                                    type: 'string',
                                    description: 'Customer email address to send the label to'
                                }
                            },
                            required: ['returnOrderId', 'customerEmail']
                        }
                    },
                    {
                        name: 'update_case_status',
                        description: 'Update a case status with optional priority and assignment changes',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                caseId: {
                                    type: 'string',
                                    description: 'The case ID to update'
                                },
                                status: {
                                    type: 'string',
                                    enum: ['New', 'Working', 'Escalated', 'Closed'],
                                    description: 'New case status'
                                },
                                reason: {
                                    type: 'string',
                                    description: 'Reason for status change (optional)'
                                },
                                priority: {
                                    type: 'string',
                                    enum: ['Low', 'Medium', 'High', 'Critical'],
                                    description: 'Case priority (optional)'
                                },
                                assignedTo: {
                                    type: 'string',
                                    description: 'User ID or username to assign case to (optional)'
                                }
                            },
                            required: ['caseId', 'status']
                        }
                    },
                    {
                        name: 'create_case_from_return',
                        description: 'Create a case from an existing return order for tracking and follow-up',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                returnOrderId: {
                                    type: 'string',
                                    description: 'The return order ID to create a case from'
                                }
                            },
                            required: ['returnOrderId']
                        }
                    },
                    {
                        name: 'send_slack_alert',
                        description: 'Send a Slack alert notification',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    description: 'The alert message to send'
                                },
                                channel: {
                                    type: 'string',
                                    description: 'Slack channel to send to (optional, uses default if not provided)'
                                },
                                priority: {
                                    type: 'string',
                                    enum: ['info', 'warning', 'error', 'critical'],
                                    description: 'Alert priority level (optional, defaults to info)'
                                },
                                caseId: {
                                    type: 'string',
                                    description: 'Related case ID (optional)'
                                }
                            },
                            required: ['message']
                        }
                    }
                ]
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                await this.salesforceClient.connect();
                switch (name) {
                    case 'check_order_status': {
                        const { orderId } = args;
                        const orderStatus = await this.salesforceClient.getOrderStatus(orderId);
                        let response = `Order ${orderStatus.orderId} status: ${orderStatus.status}`;
                        if (orderStatus.carrier) {
                            response += `\nCarrier: ${orderStatus.carrier}`;
                        }
                        if (orderStatus.trackingNumber) {
                            response += `\nTracking Number: ${orderStatus.trackingNumber}`;
                        }
                        if (orderStatus.estimatedDelivery) {
                            response += `\nEstimated Delivery: ${orderStatus.estimatedDelivery}`;
                        }
                        if (orderStatus.shippingAddress) {
                            const addr = orderStatus.shippingAddress;
                            response += `\nShipping to: ${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
                        }
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: response
                                }
                            ]
                        };
                    }
                    case 'create_return': {
                        const parsed = ReturnRequestSchema.parse(args);
                        const returnOrderId = await this.salesforceClient.createReturn(parsed);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Return order created successfully with ID: ${returnOrderId}. The return request has been submitted and will be processed within 1-2 business days.`
                                }
                            ]
                        };
                    }
                    case 'email_return_label': {
                        const parsed = ReturnLabelRequestSchema.parse(args);
                        await this.salesforceClient.emailReturnLabel(parsed.returnOrderId, parsed.customerEmail);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Return label has been emailed to ${parsed.customerEmail}. Please check your inbox (and spam folder) for the return shipping label.`
                                }
                            ]
                        };
                    }
                    case 'update_case_status': {
                        const parsed = CaseStatusUpdateSchema.parse(args);
                        await this.salesforceClient.updateCaseStatus(parsed);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Case ${parsed.caseId} status updated to ${parsed.status} successfully.`
                                }
                            ]
                        };
                    }
                    case 'create_case_from_return': {
                        const { returnOrderId } = args;
                        const caseId = await this.salesforceClient.createCaseFromReturn(returnOrderId);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Case created successfully with ID: ${caseId}. The case has been created from return order ${returnOrderId} and a Slack notification has been sent.`
                                }
                            ]
                        };
                    }
                    case 'send_slack_alert': {
                        const parsed = SlackAlertSchema.parse(args);
                        const success = await this.salesforceClient.sendSlackAlert(parsed);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: success
                                        ? `Slack alert sent successfully to ${parsed.channel || 'default channel'}.`
                                        : `Failed to send Slack alert. Please check the configuration and try again.`
                                }
                            ]
                        };
                    }
                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                // Handle different types of errors with appropriate error codes
                if (errorMessage.includes('not found')) {
                    throw new McpError(ErrorCode.InvalidRequest, errorMessage);
                }
                if (errorMessage.includes('Invalid') || errorMessage.includes('required')) {
                    throw new McpError(ErrorCode.InvalidParams, errorMessage);
                }
                if (errorMessage.includes('already exists') || errorMessage.includes('Cannot reopen')) {
                    throw new McpError(ErrorCode.InvalidRequest, errorMessage);
                }
                if (errorMessage.includes('transition') || errorMessage.includes('status')) {
                    throw new McpError(ErrorCode.InvalidRequest, errorMessage);
                }
                if (errorMessage.includes('Slack') || errorMessage.includes('webhook')) {
                    throw new McpError(ErrorCode.InternalError, `External service error: ${errorMessage}`);
                }
                if (errorMessage.includes('connect') || errorMessage.includes('login')) {
                    throw new McpError(ErrorCode.InternalError, `Salesforce connection error: ${errorMessage}`);
                }
                throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
            }
        });
    }
    async run() {
        // Detect environment - Railway vs local
        const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.PORT;
        if (isRailway) {
            // Railway: HTTP server with MCP protocol handling
            await this.startHttpMcpServer();
        }
        else {
            // Local: Standard MCP stdio server
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            console.error('Order Concierge MCP server running on stdio');
        }
    }
    async startHttpMcpServer() {
        const port = process.env.PORT || 3000;
        const httpServer = createServer(async (req, res) => {
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            try {
                if (url.pathname === '/health' || url.pathname === '/') {
                    // Health check endpoint
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'healthy',
                        service: 'Salesforce Order Concierge MCP Server',
                        version: '1.0.0',
                        mode: 'HTTP-MCP Bridge',
                        endpoints: {
                            tools: 'POST /mcp/tools/list',
                            call: 'POST /mcp/tools/call'
                        }
                    }));
                }
                else if (url.pathname === '/mcp/tools/list' && req.method === 'POST') {
                    // MCP tools list endpoint
                    const toolsResponse = await this.server.request({
                        method: 'tools/list'
                    }, ListToolsRequestSchema);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(toolsResponse));
                }
                else if (url.pathname === '/mcp/tools/call' && req.method === 'POST') {
                    // MCP tool call endpoint
                    let body = '';
                    req.on('data', chunk => body += chunk);
                    req.on('end', async () => {
                        try {
                            const requestData = JSON.parse(body);
                            const { name, arguments: args } = requestData;
                            // Validate required fields
                            if (!name || !args) {
                                res.writeHead(400, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    error: 'Bad Request',
                                    message: 'Missing required fields: name, arguments'
                                }));
                                return;
                            }
                            // Connect to Salesforce and execute tool
                            await this.salesforceClient.connect();
                            let result;
                            switch (name) {
                                case 'check_order_status': {
                                    if (!args.orderId) {
                                        throw new Error('orderId is required');
                                    }
                                    const orderStatus = await this.salesforceClient.getOrderStatus(args.orderId);
                                    let response = `Order ${orderStatus.orderId} status: ${orderStatus.status}`;
                                    if (orderStatus.carrier)
                                        response += `\nCarrier: ${orderStatus.carrier}`;
                                    if (orderStatus.trackingNumber)
                                        response += `\nTracking Number: ${orderStatus.trackingNumber}`;
                                    if (orderStatus.estimatedDelivery)
                                        response += `\nEstimated Delivery: ${orderStatus.estimatedDelivery}`;
                                    if (orderStatus.shippingAddress) {
                                        const addr = orderStatus.shippingAddress;
                                        response += `\nShipping to: ${addr.street}, ${addr.city}, ${addr.state} ${addr.zipCode}, ${addr.country}`;
                                    }
                                    result = {
                                        content: [{ type: 'text', text: response }]
                                    };
                                    break;
                                }
                                case 'create_return': {
                                    const parsed = ReturnRequestSchema.parse(args);
                                    const returnOrderId = await this.salesforceClient.createReturn(parsed);
                                    result = {
                                        content: [{
                                                type: 'text',
                                                text: `Return order created successfully with ID: ${returnOrderId}. The return request has been submitted and will be processed within 1-2 business days.`
                                            }]
                                    };
                                    break;
                                }
                                case 'email_return_label': {
                                    const parsed = ReturnLabelRequestSchema.parse(args);
                                    await this.salesforceClient.emailReturnLabel(parsed.returnOrderId, parsed.customerEmail);
                                    result = {
                                        content: [{
                                                type: 'text',
                                                text: `Return label has been emailed to ${parsed.customerEmail}. Please check your inbox (and spam folder) for the return shipping label.`
                                            }]
                                    };
                                    break;
                                }
                                case 'update_case_status': {
                                    const parsed = CaseStatusUpdateSchema.parse(args);
                                    await this.salesforceClient.updateCaseStatus(parsed);
                                    result = {
                                        content: [{
                                                type: 'text',
                                                text: `Case ${parsed.caseId} status updated to ${parsed.status} successfully.`
                                            }]
                                    };
                                    break;
                                }
                                case 'create_case_from_return': {
                                    if (!args.returnOrderId) {
                                        throw new Error('returnOrderId is required');
                                    }
                                    const caseId = await this.salesforceClient.createCaseFromReturn(args.returnOrderId);
                                    result = {
                                        content: [{
                                                type: 'text',
                                                text: `Case created successfully with ID: ${caseId}. The case has been created from return order ${args.returnOrderId} and a Slack notification has been sent.`
                                            }]
                                    };
                                    break;
                                }
                                case 'send_slack_alert': {
                                    const parsed = SlackAlertSchema.parse(args);
                                    const success = await this.salesforceClient.sendSlackAlert(parsed);
                                    result = {
                                        content: [{
                                                type: 'text',
                                                text: success
                                                    ? `Slack alert sent successfully to ${parsed.channel || 'default channel'}.`
                                                    : `Failed to send Slack alert. Please check the configuration and try again.`
                                            }]
                                    };
                                    break;
                                }
                                default:
                                    throw new Error(`Unknown tool: ${name}`);
                            }
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: true,
                                result: result
                            }));
                        }
                        catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            // Determine appropriate HTTP status code based on error type
                            let statusCode = 500;
                            let errorType = 'Internal Server Error';
                            if (errorMessage.includes('not found')) {
                                statusCode = 404;
                                errorType = 'Not Found';
                            }
                            else if (errorMessage.includes('Invalid') || errorMessage.includes('required')) {
                                statusCode = 400;
                                errorType = 'Bad Request';
                            }
                            else if (errorMessage.includes('already exists') || errorMessage.includes('Cannot reopen')) {
                                statusCode = 409;
                                errorType = 'Conflict';
                            }
                            else if (errorMessage.includes('transition') || errorMessage.includes('status')) {
                                statusCode = 422;
                                errorType = 'Unprocessable Entity';
                            }
                            else if (errorMessage.includes('connect') || errorMessage.includes('login')) {
                                statusCode = 503;
                                errorType = 'Service Unavailable';
                            }
                            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: false,
                                error: errorType,
                                message: errorMessage,
                                timestamp: new Date().toISOString()
                            }));
                        }
                    });
                }
                else {
                    // 404 for unknown endpoints
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Not Found',
                        message: 'Available endpoints: /health, /mcp/tools/list, /mcp/tools/call',
                        documentation: 'This is an MCP server accessible via HTTP for demo purposes.'
                    }));
                }
            }
            catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: 'Internal Server Error',
                    message: error instanceof Error ? error.message : 'Unknown error'
                }));
            }
        });
        httpServer.listen(port, () => {
            console.error(`MCP-HTTP Bridge server running on port ${port}`);
            console.error('Salesforce connection ready for tool calls');
        });
    }
}
const server = new OrderConciergeServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map