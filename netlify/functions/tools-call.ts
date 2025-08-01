import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { SalesforceClient } from '../../src/salesforce-client';
import { ReturnRequestSchema, ReturnLabelRequestSchema, CaseStatusUpdateSchema, SlackAlertSchema } from '../../src/types';

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
    const requestData = JSON.parse(event.body || '{}');
    const { name, arguments: args } = requestData;

    // Validate required fields
    if (!name || typeof name !== 'string' || args === undefined || args === null) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Missing required fields: name, arguments'
        })
      };
    }

    // Initialize Salesforce client
    const salesforceConfig = {
      loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
      username: process.env.SF_USERNAME || '',
      password: process.env.SF_PASSWORD || '',
      securityToken: process.env.SF_SECURITY_TOKEN || '',
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || ''
    };

    const salesforceClient = new SalesforceClient(salesforceConfig);
    await salesforceClient.connect();

    // Execute tool
    let result;
    switch (name) {
      case 'check_order_status': {
        if (!args.orderId) {
          throw new Error('orderId is required');
        }
        const orderStatus = await salesforceClient.getOrderStatus(args.orderId);
        let response = `Order Status: ${orderStatus.status}\n\nOrder Details:\n- Order ID: ${orderStatus.orderId}\n- Status: ${orderStatus.status}`;
        if (orderStatus.amount !== undefined && orderStatus.amount !== null) {
          response += `\n- Amount: $${orderStatus.amount}`;
        } else {
          response += `\n- Amount: $0.00`;
        }
        result = {
          content: [{ type: 'text', text: response }]
        };
        break;
      }

      case 'create_return': {
        const parsed = ReturnRequestSchema.parse(args);
        const returnOrderId = await salesforceClient.createReturn(parsed);
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
        await salesforceClient.emailReturnLabel(parsed.returnOrderId, parsed.customerEmail);
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
        await salesforceClient.updateCaseStatus(parsed);
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
        const caseId = await salesforceClient.createCaseFromReturn(args.returnOrderId);
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
        const success = await salesforceClient.sendSlackAlert(parsed);
        result = {
          content: [{
            type: 'text',
            text: success
              ? `Slack alert sent successfully.`
              : `Failed to send Slack alert. Please check the configuration and try again.`
          }]
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        result: result
      })
    };

  } catch (error) {
    console.error('Tool execution error:', error);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Determine appropriate HTTP status code based on error type
    let statusCode = 500;
    let errorType = 'Internal Server Error';
    
    if (errorMessage.includes('not found')) {
      statusCode = 404;
      errorType = 'Not Found';
    } else if (errorMessage.includes('Invalid') || errorMessage.includes('required')) {
      statusCode = 400;
      errorType = 'Bad Request';
    } else if (errorMessage.includes('already exists') || errorMessage.includes('Cannot reopen')) {
      statusCode = 409;
      errorType = 'Conflict';
    } else if (errorMessage.includes('transition') || errorMessage.includes('status')) {
      statusCode = 422;
      errorType = 'Unprocessable Entity';
    } else if (errorMessage.includes('connect') || errorMessage.includes('login')) {
      statusCode = 503;
      errorType = 'Service Unavailable';
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorType,
        message: errorMessage,
        timestamp: new Date().toISOString()
      })
    };
  }
};

export { handler };