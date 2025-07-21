import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { SalesforceClient } from '../../src/salesforce-client';
import { SalesforceConfig, SlackAlertSchema, ReturnRequestSchema, ReturnLabelRequestSchema, CaseStatusUpdateSchema } from '../../src/types';

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        error: 'Method Not Allowed',
        message: 'Only POST requests are allowed'
      })
    };
  }

  try {
    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'Request body is required'
        })
      };
    }

    const requestData = JSON.parse(event.body);
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

    // Create Salesforce config
    const config = {
      loginUrl: process.env.SF_LOGIN_URL || '',
      username: process.env.SF_USERNAME || '',
      password: process.env.SF_PASSWORD || '',
      securityToken: process.env.SF_SECURITY_TOKEN || '',
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || ''
    };

    const salesforceClient = new SalesforceClient(config);

    // Connect to Salesforce
    await salesforceClient.connect();

    // Execute tool
    let result;
    switch (name) {
      case 'check_order_status': {
        if (!args.orderId) {
          throw new Error('orderId is required');
        }
        const orderDetails = await salesforceClient.getOrderStatus(args.orderId);
        result = {
          content: [{
            type: 'text',
            text: `Order Status: ${orderDetails.status}\n\nOrder Details:\n- Order ID: ${orderDetails.orderId}\n- Amount: $${orderDetails.amount}\n- Status: ${orderDetails.status}\n- Account Number: ${orderDetails.accountNumber}\n- Effective Date: ${orderDetails.effectiveDate}${orderDetails.billingAddress ? `\n\nBilling Address:\n- Name: ${orderDetails.billingAddress.name}\n- City: ${orderDetails.billingAddress.city}\n- State: ${orderDetails.billingAddress.state}\n- Country: ${orderDetails.billingAddress.country}\n- Email: ${orderDetails.billingAddress.email}` : ''}`
          }]
        };
        break;
      }

      case 'create_return': {
        const parsed = ReturnRequestSchema.parse(args);
        const returnOrderId = await salesforceClient.createReturn(parsed);
        result = {
          content: [{
            type: 'text',
            text: `Return request created successfully! Return Order ID: ${returnOrderId}`
          }]
        };
        break;
      }

      case 'email_return_label': {
        const parsed = ReturnLabelRequestSchema.parse(args);
        const success = await salesforceClient.emailReturnLabel(parsed.returnOrderId, parsed.emailAddress);
        result = {
          content: [{
            type: 'text',
            text: success 
              ? `Return label sent successfully to ${parsed.emailAddress}` 
              : 'Failed to send return label. Please check the email address and try again.'
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

      case 'update_case_status': {
        const parsed = CaseStatusUpdateSchema.parse(args);
        const success = await salesforceClient.updateCaseStatus(parsed);
        result = {
          content: [{
            type: 'text',
            text: success 
              ? `Case ${parsed.caseId} status updated successfully to ${parsed.status}.`
              : `Failed to update case ${parsed.caseId} status. Please check the case ID and try again.`
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
              ? 'Slack alert sent successfully.'
              : 'Failed to send Slack alert. Please check the configuration and try again.'
          }]
        };
        break;
      }

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Bad Request',
            message: `Unknown tool: ${name}`
          })
        };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        result
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
    } else if (errorMessage.includes('Unauthorized') || errorMessage.includes('authentication')) {
      statusCode = 401;
      errorType = 'Unauthorized';
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorType,
        message: errorMessage
      })
    };
  }
};

export { handler };