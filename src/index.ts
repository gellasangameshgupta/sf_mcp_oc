#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer } from 'http';
import { SalesforceClient } from './salesforce-client.js';
import { OrderStatusSchema, ReturnRequestSchema, ReturnLabelRequestSchema, SalesforceConfig } from './types.js';

class OrderConciergeServer {
  private server: Server;
  private salesforceClient: SalesforceClient;

  constructor() {
    this.server = new Server(
      {
        name: 'salesforce-order-concierge',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    const config: SalesforceConfig = {
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

  private setupToolHandlers() {
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
            const { orderId } = args as { orderId: string };
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
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('not found')) {
          throw new McpError(ErrorCode.InvalidRequest, errorMessage);
        }
        
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
      }
    });
  }

  async run() {
    // Start HTTP health check server for Railway
    const port = process.env.PORT || 3000;
    const httpServer = createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      
      // Set CORS headers for demo purposes
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      try {
        if (url.pathname === '/health' || url.pathname === '/') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'healthy',
            service: 'Salesforce Order Concierge MCP Server',
            version: '1.0.0',
            capabilities: ['check_order_status', 'create_return', 'email_return_label'],
            demo_endpoints: [
              '/demo/order-status?orderId=12345',
              '/demo/tools',
              '/demo/docs'
            ]
          }));
        } 
        else if (url.pathname === '/demo/tools') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            tools: [
              {
                name: 'check_order_status',
                description: 'Check order shipping status, carrier, tracking number, and ETA',
                example: '/demo/order-status?orderId=12345'
              },
              {
                name: 'create_return',
                description: 'Create a return (RMA) for a single line item',
                example: 'POST /demo/return with JSON body'
              },
              {
                name: 'email_return_label',
                description: 'Email customer a PDF return label',
                example: 'POST /demo/return-label with JSON body'
              }
            ]
          }));
        }
        else if (url.pathname === '/demo/order-status') {
          const orderId = url.searchParams.get('orderId');
          if (!orderId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'orderId parameter required' }));
            return;
          }
          
          // Demo response (not connected to real Salesforce)
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            demo: true,
            message: 'This is a demo response. Real implementation requires Salesforce connection.',
            orderId: orderId,
            status: 'Shipped',
            carrier: 'UPS',
            trackingNumber: 'UPS123456789',
            estimatedDelivery: '2024-07-02',
            shippingAddress: {
              street: '123 Demo Street',
              city: 'Demo City',
              state: 'CA',
              zipCode: '12345',
              country: 'USA'
            }
          }));
        }
        else if (url.pathname === '/demo/docs') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Salesforce Order Concierge - Demo</title>
              <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
                .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
                .method { color: #0066cc; font-weight: bold; }
                code { background: #eee; padding: 2px 4px; border-radius: 3px; }
              </style>
            </head>
            <body>
              <h1>🛍️ Salesforce Order Concierge MCP Server</h1>
              <p>This is a Model Context Protocol (MCP) server for ecommerce customer service operations.</p>
              
              <h2>🚀 Demo Endpoints</h2>
              <div class="endpoint">
                <div class="method">GET</div>
                <strong>/health</strong> - Server health check
              </div>
              
              <div class="endpoint">
                <div class="method">GET</div>
                <strong>/demo/tools</strong> - List available MCP tools
              </div>
              
              <div class="endpoint">
                <div class="method">GET</div>
                <strong>/demo/order-status?orderId=12345</strong> - Demo order status check
              </div>
              
              <h2>🔧 Real Usage</h2>
              <p>This server is designed to work with <strong>Claude Desktop</strong> via the MCP protocol, not HTTP requests.</p>
              <p>For production use, configure it in Claude Desktop's MCP settings.</p>
              
              <h2>🎯 Capabilities</h2>
              <ul>
                <li>Check order shipping status and tracking</li>
                <li>Create returns (RMA) for line items</li>
                <li>Email return labels to customers</li>
              </ul>
              
              <p><em>Demo responses are mock data. Real implementation connects to Salesforce.</em></p>
            </body>
            </html>
          `);
        }
        else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'Not Found',
            message: 'This is an MCP server. Available demo endpoints: /health, /demo/tools, /demo/order-status, /demo/docs',
            available_endpoints: ['/health', '/demo/tools', '/demo/order-status?orderId=12345', '/demo/docs']
          }));
        }
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }));
      }
    });

    httpServer.listen(port, () => {
      console.error(`HTTP health server running on port ${port}`);
    });

    // Start MCP server on stdio
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Order Concierge MCP server running on stdio');
  }
}

const server = new OrderConciergeServer();
server.run().catch(console.error);