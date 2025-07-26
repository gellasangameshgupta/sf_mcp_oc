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
    const config = {
      loginUrl: process.env.SF_LOGIN_URL || '',
      username: process.env.SF_USERNAME || '',
      password: process.env.SF_PASSWORD || '',
      securityToken: process.env.SF_SECURITY_TOKEN || '',
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || ''
    };

    const salesforceClient = new SalesforceClient(config);

    // Test Salesforce connection
    let salesforceStatus = 'disconnected';
    let salesforceError = '';
    try {
      await salesforceClient.connect();
      salesforceStatus = 'connected';
    } catch (error) {
      salesforceStatus = 'connection_failed';
      salesforceError = error instanceof Error ? error.message : String(error);
      console.error('Salesforce connection error:', salesforceError);
    }

    const response = {
      status: 'healthy',
      service: 'Salesforce Order Concierge MCP Server',
      version: '1.0.0',
      mode: 'Netlify Functions',
      platform: 'Netlify',
      salesforce: salesforceStatus,
      salesforceError: salesforceError || undefined,
      config: {
        loginUrl: config.loginUrl,
        username: !!config.username,
        password: !!config.password,
        securityToken: !!config.securityToken,
        hasSlackWebhook: !!config.slackWebhookUrl
      },
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