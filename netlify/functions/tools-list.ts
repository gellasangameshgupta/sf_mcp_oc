import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: 'Method Not Allowed',
        message: 'Only POST requests are supported'
      })
    };
  }

  try {
    const toolsResponse = {
      tools: [
        {
          name: 'check_order_status',
          description: 'Check the status and details of a Salesforce order by ID or order number',
          inputSchema: {
            type: 'object',
            properties: {
              orderId: {
                type: 'string',
                description: 'Salesforce Order ID (15/18 chars) or Order Number'
              }
            },
            required: ['orderId']
          }
        },
        {
          name: 'create_return',
          description: 'Create a return order request for defective or damaged items',
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
          description: 'Email a return shipping label to customer',
          inputSchema: {
            type: 'object',
            properties: {
              returnOrderId: {
                type: 'string',
                description: 'The return order ID'
              },
              customerEmail: {
                type: 'string',
                description: 'Customer email address'
              }
            },
            required: ['returnOrderId', 'customerEmail']
          }
        },
        {
          name: 'create_case_from_return',
          description: 'Create a support case from a return order',
          inputSchema: {
            type: 'object',
            properties: {
              returnOrderId: {
                type: 'string',
                description: 'The return order ID to create case from'
              }
            },
            required: ['returnOrderId']
          }
        },
        {
          name: 'update_case_status',
          description: 'Update the status of a support case',
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
          name: 'send_slack_alert',
          description: 'Send a Slack alert notification',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'The alert message to send'
              },
              priority: {
                type: 'string',
                enum: ['info', 'warning', 'error', 'critical'],
                description: 'Alert priority level (optional, defaults to info)'
              },
              caseId: {
                type: 'string',
                description: 'Related case ID (optional)'
              },
              customFields: {
                type: 'object',
                description: 'Additional custom fields to include in the alert (optional)'
              }
            },
            required: ['message']
          }
        }
      ]
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(toolsResponse)
    };
  } catch (error) {
    console.error('Tools list error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };