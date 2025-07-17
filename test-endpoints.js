#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

async function testEndpoint(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function main() {
  console.log('🚀 Starting server...');
  
  const server = spawn('node', ['dist/cli.js', 'start'], {
    stdio: 'pipe'
  });

  server.stdout.on('data', (data) => {
    console.log('Server:', data.toString().trim());
  });

  server.stderr.on('data', (data) => {
    console.error('Server Error:', data.toString().trim());
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n📋 Testing endpoints...\n');

  // Test standard endpoint first
  try {
    const response = await testEndpoint(3456, '/');
    console.log(`✅ Root endpoint: ${response.statusCode}`);
  } catch (error) {
    console.log(`❌ Root endpoint: ${error.message}`);
  }

  // Test our Synapse endpoints
  const endpoints = [
    '/api/synapse/health',
    '/api/synapse/config',
    '/api/synapse/usage'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await testEndpoint(3456, endpoint);
      console.log(`✅ ${endpoint}: ${response.statusCode}`);
      if (response.data) {
        console.log(`   Data: ${response.data.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.message}`);
    }
  }

  server.kill();
  console.log('\n🏁 Tests completed');
}

main().catch(console.error);