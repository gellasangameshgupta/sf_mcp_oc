import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { SalesforceClient } from '../../src/salesforce-client';

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

  try {
    // Initialize Salesforce client
    const salesforceConfig = {
      loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
      username: process.env.SF_USERNAME || '',
      password: process.env.SF_PASSWORD || '',
      securityToken: process.env.SF_SECURITY_TOKEN || '',
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || ''
    };

    let salesforceStatus = 'disconnected';
    try {
      const client = new SalesforceClient(salesforceConfig);
      await client.connect();
      salesforceStatus = 'connected';
    } catch (error) {
      salesforceStatus = 'connection_failed';
    }

    const response = {
      status: 'healthy',
      service: 'Salesforce Order Concierge MCP Server',
      version: '1.0.0',
      mode: 'Netlify Functions',
      salesforce: salesforceStatus,
      endpoints: {
        tools: 'POST /mcp/tools/list',
        call: 'POST /mcp/tools/call'
      }
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('Health check error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };