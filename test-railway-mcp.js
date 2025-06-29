#!/usr/bin/env node

// Test script for Railway MCP HTTP bridge
const BASE_URL = 'https://sfmcpoc-production.up.railway.app';

async function testRailwayMCP() {
  console.log('🧪 Testing Railway MCP HTTP Bridge...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData);

    // Test 2: List tools
    console.log('\n2️⃣ Testing tools list...');
    const toolsResponse = await fetch(`${BASE_URL}/mcp/tools/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const toolsData = await toolsResponse.json();
    console.log('✅ Tools available:', toolsData.tools?.length || 0);

    // Test 3: Check order status (will connect to real Salesforce)
    console.log('\n3️⃣ Testing order status check...');
    const orderResponse = await fetch(`${BASE_URL}/mcp/tools/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'check_order_status',
        arguments: {
          orderId: 'TEST-12345'
        }
      })
    });
    const orderData = await orderResponse.json();
    
    if (orderData.success) {
      console.log('✅ Order status check successful');
      console.log('📦 Response:', orderData.result.content[0].text);
    } else {
      console.log('⚠️ Order status check failed:', orderData.error);
    }

    console.log('\n🎯 Railway MCP Server is working!');
    console.log('🔗 Demo URLs:');
    console.log(`- Health: ${BASE_URL}/health`);
    console.log(`- Tools: ${BASE_URL}/mcp/tools/list`);
    console.log(`- Call: ${BASE_URL}/mcp/tools/call`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testRailwayMCP();
}

export { testRailwayMCP };