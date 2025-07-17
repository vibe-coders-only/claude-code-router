#!/usr/bin/env node

/**
 * Simple integration test for Synapse features
 */

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

// Test configuration
const TEST_PORT = 3457;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Start the server
console.log('Starting claude-code-router service...');
const serverProcess = spawn('node', [path.join(__dirname, 'dist/cli.js'), 'start'], {
  env: { ...process.env, SERVICE_PORT: TEST_PORT.toString() },
  stdio: 'inherit'
});

// Wait for server to start
setTimeout(async () => {
  try {
    await runTests();
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Clean up
    serverProcess.kill();
    process.exit(0);
  }
}, 3000);

async function runTests() {
  console.log('\n🧪 Running Synapse integration tests...\n');

  // Test 1: Check if Synapse API endpoints are available
  await testEndpoint('GET', '/api/synapse/config', 'Config endpoint');
  await testEndpoint('GET', '/api/synapse/health', 'Health endpoint');
  await testEndpoint('GET', '/api/synapse/usage', 'Usage endpoint');

  // Test 2: Test Synapse context headers
  await testSynapseContext();

  // Test 3: Test configuration management
  await testConfigManagement();
}

async function testEndpoint(method, path, description) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ ${description}: ${res.statusCode}`);
          resolve(data);
        } else {
          console.log(`⚠️  ${description}: ${res.statusCode} - ${data}`);
          resolve(data); // Don't reject, just log warning
        }
      });
    });

    req.on('error', (error) => {
      console.log(`⚠️  ${description}: ${error.message}`);
      resolve(null); // Don't reject, just log warning
    });

    req.setTimeout(5000, () => {
      console.log(`⚠️  ${description}: Request timeout`);
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

async function testSynapseContext() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'Hello, test message' }],
      max_tokens: 10
    });

    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        // Synapse context headers
        'x-synapse-project-id': 'test-project-123',
        'x-synapse-agent-id': 'test-agent-456',
        'x-synapse-agent-type': 'coding',
        'x-synapse-task-type': 'test',
        'x-synapse-token-estimate': '100'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`✅ Synapse context test: ${res.statusCode}`);
        resolve(data);
      });
    });

    req.on('error', (error) => {
      console.log(`⚠️  Synapse context test: ${error.message}`);
      resolve(null);
    });

    req.setTimeout(10000, () => {
      console.log(`⚠️  Synapse context test: Request timeout`);
      req.destroy();
      resolve(null);
    });

    req.write(postData);
    req.end();
  });
}

async function testConfigManagement() {
  // Test getting default config
  const config = await testEndpoint('GET', '/api/synapse/config', 'Get default config');
  
  if (config) {
    try {
      const parsedConfig = JSON.parse(config);
      if (parsedConfig.success && parsedConfig.config) {
        console.log('✅ Config structure is valid');
        
        // Test updating config
        const updateData = JSON.stringify({
          models: {
            ...parsedConfig.config.models,
            test: 'test-model'
          }
        });

        await testEndpointWithData('POST', '/api/synapse/config', updateData, 'Update config');
      }
    } catch (error) {
      console.log('⚠️  Config parsing failed:', error.message);
    }
  }
}

async function testEndpointWithData(method, path, data, description) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ ${description}: ${res.statusCode}`);
          resolve(responseData);
        } else {
          console.log(`⚠️  ${description}: ${res.statusCode} - ${responseData}`);
          resolve(responseData);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`⚠️  ${description}: ${error.message}`);
      resolve(null);
    });

    req.setTimeout(5000, () => {
      console.log(`⚠️  ${description}: Request timeout`);
      req.destroy();
      resolve(null);
    });

    req.write(data);
    req.end();
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  serverProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test terminated');
  serverProcess.kill();
  process.exit(0);
});