#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function testMCPServer() {
  console.log('🧪 Testing Order Concierge MCP Server...\n');

  const serverPath = join(__dirname, 'dist', 'index.js');
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responseData = '';

  server.stdout.on('data', (data) => {
    responseData += data.toString();
  });

  server.stderr.on('data', (data) => {
    console.log('Server stderr:', data.toString());
  });

  // Test 1: List tools
  console.log('1️⃣ Testing list_tools...');
  const listToolsRequest = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  }) + '\n';

  server.stdin.write(listToolsRequest);

  setTimeout(() => {
    // Test 2: Check order status (will fail without real SF credentials)
    console.log('2️⃣ Testing check_order_status...');
    const checkOrderRequest = JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'check_order_status',
        arguments: {
          orderId: 'TEST-12345'
        }
      }
    }) + '\n';

    server.stdin.write(checkOrderRequest);

    setTimeout(() => {
      server.kill();
      
      console.log('\n📊 Test Results:');
      if (responseData.includes('check_order_status')) {
        console.log('✅ Tools properly registered');
      } else {
        console.log('❌ Tools not found in response');
      }

      if (responseData.includes('shipping status')) {
        console.log('✅ Tool descriptions correct');
      } else {
        console.log('❌ Tool descriptions missing');
      }

      console.log('\n📋 Raw server responses:');
      console.log(responseData);
      
      console.log('\n🎯 Next steps:');
      console.log('1. Configure Salesforce credentials in .env');
      console.log('2. Test with real order data');
      console.log('3. Integrate with Claude Code using MCP');
      
    }, 2000);
  }, 1000);

  server.on('error', (error) => {
    console.error('❌ Server failed to start:', error.message);
  });
}

testMCPServer();