#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');

const TEST_PORT = 3456; // Use default port
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function httpRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = responseData ? JSON.parse(responseData) : null;
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed,
            raw: responseData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: null,
            raw: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function startServer() {
  console.log('🚀 Starting server...');
  
  serverProcess = spawn('node', ['dist/cli.js', 'start'], {
    stdio: 'pipe'
  });

  serverProcess.stdout.on('data', (data) => {
    console.log('Server:', data.toString().trim());
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('Server Error:', data.toString().trim());
  });

  await delay(5000); // Wait for server to start
}

async function testEndpoints() {
  console.log('\n📋 Testing Synapse API endpoints...\n');

  const tests = [
    { name: 'Health Check', path: '/api/synapse/health', method: 'GET' },
    { name: 'Configuration', path: '/api/synapse/config', method: 'GET' },
    { name: 'Usage Stats', path: '/api/synapse/usage', method: 'GET' },
  ];

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      const response = await httpRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: test.path,
        method: test.method,
        headers: { 'Content-Type': 'application/json' }
      });

      console.log(`✅ ${test.name}: ${response.statusCode}`);
      if (response.data) {
        console.log(`   Data: ${JSON.stringify(response.data, null, 2)}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }

  // Test Synapse context
  console.log('\n🔍 Testing Synapse context extraction...\n');
  
  try {
    const requestData = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'Hello test' }],
      max_tokens: 10
    });

    const response = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData),
        'x-synapse-project-id': 'test-project',
        'x-synapse-agent-id': 'test-agent',
        'x-synapse-agent-type': 'coding'
      }
    }, requestData);

    console.log(`✅ Synapse Context Test: ${response.statusCode}`);
    if (response.raw) {
      console.log(`   Response: ${response.raw.substring(0, 200)}...`);
    }
  } catch (error) {
    console.log(`❌ Synapse Context Test: ${error.message}`);
  }
}

async function main() {
  try {
    await startServer();
    await testEndpoints();
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
    console.log('\n🏁 Tests completed');
  }
}

process.on('SIGINT', () => {
  console.log('\n🛑 Interrupted');
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});

main();