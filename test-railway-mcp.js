#!/usr/bin/env node

// Test script for Railway MCP HTTP bridge with real Salesforce data
const BASE_URL = 'https://sfmcpoc-production.up.railway.app';

async function testRailwayMCP(realOrderId = null) {
  console.log('🧪 Testing Railway MCP HTTP Bridge with Real Salesforce Data...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', JSON.stringify(healthData, null, 2));

    // Test 2: List tools
    console.log('\n2️⃣ Testing tools list...');
    const toolsResponse = await fetch(`${BASE_URL}/mcp/tools/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const toolsData = await toolsResponse.json();
    console.log('✅ Available tools:');
    if (toolsData.tools) {
      toolsData.tools.forEach((tool, i) => {
        console.log(`   ${i + 1}. ${tool.name} - ${tool.description}`);
      });
    }

    // Test 3: Check order status with real or test order ID
    const orderId = realOrderId || 'TEST-12345';
    console.log(`\n3️⃣ Testing order status check with Order ID: ${orderId}...`);
    
    const orderResponse = await fetch(`${BASE_URL}/mcp/tools/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'check_order_status',
        arguments: {
          orderId: orderId
        }
      })
    });
    const orderData = await orderResponse.json();
    
    if (orderData.success) {
      console.log('✅ Order status check successful!');
      console.log('📦 Order Details:');
      console.log(orderData.result.content[0].text);
    } else {
      console.log('⚠️ Order status check failed:', orderData.error);
      if (orderData.error.includes('not found')) {
        console.log('💡 Try using a real Order ID from your Salesforce org');
      }
    }

    // Test 4: Error handling with invalid order
    console.log('\n4️⃣ Testing error handling...');
    const errorResponse = await fetch(`${BASE_URL}/mcp/tools/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'check_order_status',
        arguments: {
          orderId: 'INVALID-ORDER-123'
        }
      })
    });
    const errorData = await errorResponse.json();
    console.log('✅ Error handling works:', errorData.error ? 'Proper error returned' : 'Unexpected success');

    console.log('\n🎯 Railway MCP Server Test Complete!');
    console.log('\n📋 Usage Instructions:');
    console.log('1. Get a real Order Number from your Salesforce org');
    console.log('2. Run: node test-railway-mcp.js [ORDER_NUMBER]');
    console.log('3. Or use curl/Postman with the endpoints above');
    
    console.log('\n🔗 Available Endpoints:');
    console.log(`• Health Check: GET ${BASE_URL}/health`);
    console.log(`• List Tools: POST ${BASE_URL}/mcp/tools/list`);
    console.log(`• Execute Tool: POST ${BASE_URL}/mcp/tools/call`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Interactive testing function
async function testWithRealOrder() {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('Enter a real Salesforce Order Number (or press Enter to skip): ', (orderNumber) => {
      rl.close();
      testRailwayMCP(orderNumber.trim() || null).then(resolve);
    });
  });
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const orderNumber = process.argv[2];
  if (orderNumber) {
    console.log(`Using provided Order Number: ${orderNumber}`);
    testRailwayMCP(orderNumber);
  } else {
    testWithRealOrder();
  }
}

export { testRailwayMCP, testWithRealOrder };