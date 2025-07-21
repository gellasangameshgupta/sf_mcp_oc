import { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { SalesforceClient } from '../../src/salesforce-client';
import { SalesforceConfig } from '../../src/types';

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

  try {
    // Create Salesforce config
    const config: SalesforceConfig = {
      loginUrl: process.env.SF_LOGIN_URL || 'https://login.salesforce.com',
      username: process.env.SF_USERNAME || '',
      password: process.env.SF_PASSWORD || '',
      securityToken: process.env.SF_SECURITY_TOKEN,
      clientId: process.env.SF_CLIENT_ID,
      clientSecret: process.env.SF_CLIENT_SECRET,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
    };

    const salesforceClient = new SalesforceClient(config);

    // Test Salesforce connection
    let salesforceStatus = 'disconnected';
    try {
      await salesforceClient.connect();
      salesforceStatus = 'connected';
    } catch (error) {
      salesforceStatus = 'connection_failed';
    }

    const response = {
      status: 'healthy',
      service: 'Salesforce Order Concierge MCP Server',
      version: '1.0.0',
      mode: 'Netlify Functions',
      platform: 'Netlify',
      salesforce: salesforceStatus,
      endpoints: {
        health: 'GET /.netlify/functions/health',
        tools: 'POST /.netlify/functions/tools-list',
        call: 'POST /.netlify/functions/tools-call'
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
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };