#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListToolsRequestSchema, McpError, } from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'http';
import { SalesforceClient } from './salesforce-client.js';
import { ReturnRequestSchema, ReturnLabelRequestSchema } from './types.js';
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
                        description: 'Create a return (RMA) for a single line item in an order',
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
                                    description: 'Reason for the return'
                                },
                                quantity: {
                                    type: 'number',
                                    description: 'Quantity to return',
                                    minimum: 1
                                }
                            },
                            required: ['orderId', 'lineItemId', 'reason', 'quantity']
                        }
                    },
                    {
                        name: 'email_return_label',
                        description: 'Email the customer a PDF return label that has already been generated',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                returnId: {
                                    type: 'string',
                                    description: 'The return ID for which to send the label'
                                },
                                customerEmail: {
                                    type: 'string',
                                    description: 'Customer email address to send the label to'
                                }
                            },
                            required: ['returnId', 'customerEmail']
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
                        const returnId = await this.salesforceClient.createReturn(parsed);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Return created successfully with ID: ${returnId}. The return request has been submitted and will be processed within 1-2 business days.`
                                }
                            ]
                        };
                    }
                    case 'email_return_label': {
                        const parsed = ReturnLabelRequestSchema.parse(args);
                        await this.salesforceClient.emailReturnLabel(parsed.returnId, parsed.customerEmail);
                        return {
                            content: [
                                {
                                    type: 'text',
                                    text: `Return label has been emailed to ${parsed.customerEmail}. Please check your inbox (and spam folder) for the return shipping label.`
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
                if (errorMessage.includes('not found')) {
                    throw new McpError(ErrorCode.InvalidRequest, errorMessage);
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
                                    const returnId = await this.salesforceClient.createReturn(parsed);
                                    result = {
                                        content: [{
                                                type: 'text',
                                                text: `Return created successfully with ID: ${returnId}. The return request has been submitted and will be processed within 1-2 business days.`
                                            }]
                                    };
                                    break;
                                }
                                case 'email_return_label': {
                                    const parsed = ReturnLabelRequestSchema.parse(args);
                                    await this.salesforceClient.emailReturnLabel(parsed.returnId, parsed.customerEmail);
                                    result = {
                                        content: [{
                                                type: 'text',
                                                text: `Return label has been emailed to ${parsed.customerEmail}. Please check your inbox (and spam folder) for the return shipping label.`
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
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                success: false,
                                error: errorMessage
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