#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
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
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Order Concierge MCP server running on stdio');
  }
}

const server = new OrderConciergeServer();
server.run().catch(console.error);