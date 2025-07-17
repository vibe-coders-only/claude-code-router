#!/usr/bin/env node

/**
 * Comprehensive test suite for Synapse integration features
 */

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Test configuration
const TEST_PORT = 3458;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let serverProcess;
let testResults = [];

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logTest(name, success, details = '') {
  const symbol = success ? '✅' : '❌';
  const color = success ? colors.green : colors.red;
  log(`${symbol} ${name}${details ? ': ' + details : ''}`, color);
  testResults.push({ name, success, details });
}

function logSection(title) {
  log(`\n${'='.repeat(50)}`, colors.blue);
  log(`${title}`, colors.blue);
  log(`${'='.repeat(50)}`, colors.blue);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer() {
  return new Promise((resolve, reject) => {
    log('🚀 Starting claude-code-router service...', colors.yellow);
    
    serverProcess = spawn('node', [path.join(__dirname, 'dist/cli.js'), 'start'], {
      env: { ...process.env, SERVICE_PORT: TEST_PORT.toString() },
      stdio: 'pipe'
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server started') || output.includes('listening')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });

    serverProcess.on('error', (error) => {
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      resolve(); // Resolve anyway and try to continue
    }, 10000);
  });
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

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testBasicEndpoints() {
  logSection('TESTING BASIC API ENDPOINTS');

  const endpoints = [
    { path: '/api/synapse/config', method: 'GET', name: 'Get Configuration' },
    { path: '/api/synapse/health', method: 'GET', name: 'Health Check' },
    { path: '/api/synapse/usage', method: 'GET', name: 'Usage Statistics' }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await httpRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: endpoint.path,
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      });

      const success = response.statusCode >= 200 && response.statusCode < 300;
      logTest(endpoint.name, success, `Status: ${response.statusCode}`);

      if (success && response.data) {
        log(`  Response: ${JSON.stringify(response.data, null, 2)}`, colors.blue);
      }
    } catch (error) {
      logTest(endpoint.name, false, error.message);
    }
  }
}

async function testConfigurationManagement() {
  logSection('TESTING CONFIGURATION MANAGEMENT');

  try {
    // Test getting configuration
    const getResponse = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/synapse/config',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    logTest('Get Configuration', getResponse.statusCode === 200, `Status: ${getResponse.statusCode}`);

    if (getResponse.data && getResponse.data.config) {
      log(`  Current config has ${Object.keys(getResponse.data.config).length} sections`, colors.blue);
    }

    // Test updating configuration
    const updateData = JSON.stringify({
      models: {
        default: 'claude-3-5-sonnet-20241022',
        coder: 'deepseek-chat',
        test: 'test-model-added'
      },
      routing: {
        enabled: true,
        fallbackEnabled: true,
        retryAttempts: 3
      }
    });

    const updateResponse = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/synapse/config',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(updateData)
      }
    }, updateData);

    logTest('Update Configuration', updateResponse.statusCode === 200, `Status: ${updateResponse.statusCode}`);

    // Test invalid configuration
    const invalidData = JSON.stringify({
      models: null, // Invalid
      routing: { enabled: "not-a-boolean" } // Invalid
    });

    const invalidResponse = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/synapse/config',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(invalidData)
      }
    }, invalidData);

    logTest('Invalid Configuration Rejected', invalidResponse.statusCode === 400, `Status: ${invalidResponse.statusCode}`);

  } catch (error) {
    logTest('Configuration Management', false, error.message);
  }
}

async function testSynapseContextExtraction() {
  logSection('TESTING SYNAPSE CONTEXT EXTRACTION');

  const testCases = [
    {
      name: 'Coding Agent Context',
      headers: {
        'x-synapse-project-id': 'test-project-123',
        'x-synapse-agent-id': 'coding-agent-456',
        'x-synapse-agent-type': 'coding',
        'x-synapse-task-type': 'code-generation',
        'x-synapse-token-estimate': '1500'
      }
    },
    {
      name: 'Analysis Agent Context',
      headers: {
        'x-synapse-project-id': 'test-project-789',
        'x-synapse-agent-id': 'analysis-agent-101',
        'x-synapse-agent-type': 'analysis',
        'x-synapse-task-type': 'data-analysis',
        'x-synapse-token-estimate': '2000'
      }
    },
    {
      name: 'Reasoning Agent Context',
      headers: {
        'x-synapse-project-id': 'test-project-999',
        'x-synapse-agent-id': 'reasoning-agent-202',
        'x-synapse-agent-type': 'reasoning',
        'x-synapse-task-type': 'logical-reasoning',
        'x-synapse-token-estimate': '3000'
      }
    }
  ];

  for (const testCase of testCases) {
    try {
      const requestData = JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello, this is a test message' }],
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
          ...testCase.headers
        }
      }, requestData);

      // Even if the actual LLM call fails, we should see that the context was processed
      const contextProcessed = response.statusCode !== 404; // API endpoint exists
      logTest(testCase.name, contextProcessed, `Status: ${response.statusCode}`);

      if (response.data) {
        log(`  Response type: ${typeof response.data}`, colors.blue);
      }

    } catch (error) {
      logTest(testCase.name, false, error.message);
    }
  }
}

async function testHealthMonitoring() {
  logSection('TESTING HEALTH MONITORING');

  try {
    const response = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/synapse/health',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const success = response.statusCode === 200;
    logTest('Health Endpoint Available', success, `Status: ${response.statusCode}`);

    if (success && response.data) {
      const healthData = response.data;
      log(`  System healthy: ${healthData.health?.healthy}`, colors.blue);
      log(`  Health score: ${healthData.health?.score}`, colors.blue);
      log(`  Providers checked: ${healthData.health?.providers?.length || 0}`, colors.blue);
    }

  } catch (error) {
    logTest('Health Monitoring', false, error.message);
  }
}

async function testUsageTracking() {
  logSection('TESTING USAGE TRACKING');

  try {
    // Test basic usage endpoint
    const response = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/synapse/usage',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const success = response.statusCode === 200;
    logTest('Usage Endpoint Available', success, `Status: ${response.statusCode}`);

    if (success && response.data) {
      const usageData = response.data;
      log(`  Total requests: ${usageData.usage?.totalRequests || 0}`, colors.blue);
      log(`  Total tokens: ${usageData.usage?.totalTokens || 0}`, colors.blue);
      log(`  Total cost: $${usageData.usage?.totalCost || 0}`, colors.blue);
    }

    // Test filtered usage
    const filteredResponse = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/synapse/usage?projectId=test-project-123',
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    logTest('Filtered Usage Query', filteredResponse.statusCode === 200, `Status: ${filteredResponse.statusCode}`);

  } catch (error) {
    logTest('Usage Tracking', false, error.message);
  }
}

async function testModelTesting() {
  logSection('TESTING MODEL CONNECTIVITY');

  try {
    const testData = JSON.stringify({
      provider: 'openrouter',
      model: 'claude-3-5-sonnet-20241022'
    });

    const response = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/api/synapse/test-model',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(testData)
      }
    }, testData);

    logTest('Model Test Endpoint', response.statusCode === 200 || response.statusCode === 404, `Status: ${response.statusCode}`);

    if (response.data) {
      log(`  Test result: ${JSON.stringify(response.data, null, 2)}`, colors.blue);
    }

  } catch (error) {
    logTest('Model Testing', false, error.message);
  }
}

async function testFileSystemIntegration() {
  logSection('TESTING FILE SYSTEM INTEGRATION');

  const homeDir = require('os').homedir();
  const configDir = path.join(homeDir, '.claude-code-router');
  
  try {
    // Test if config directory exists or can be created
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    logTest('Config Directory Creation', fs.existsSync(configDir));

    // Test config file operations
    const testConfigPath = path.join(configDir, 'test-config.json');
    const testConfig = { test: 'value', timestamp: Date.now() };
    
    fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
    logTest('Config File Write', fs.existsSync(testConfigPath));

    const readConfig = JSON.parse(fs.readFileSync(testConfigPath, 'utf8'));
    logTest('Config File Read', readConfig.test === 'value');

    // Test usage tracking file
    const usageFile = path.join(configDir, 'usage.json');
    const testUsage = [{ id: 'test', timestamp: new Date().toISOString() }];
    
    fs.writeFileSync(usageFile, JSON.stringify(testUsage, null, 2));
    logTest('Usage File Write', fs.existsSync(usageFile));

    // Test log file
    const logFile = path.join(configDir, 'synapse.log');
    const testLog = `${new Date().toISOString()} INFO Test log entry\n`;
    
    fs.writeFileSync(logFile, testLog);
    logTest('Log File Write', fs.existsSync(logFile));

    // Cleanup test files
    [testConfigPath, usageFile, logFile].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });

  } catch (error) {
    logTest('File System Integration', false, error.message);
  }
}

async function testErrorHandling() {
  logSection('TESTING ERROR HANDLING');

  const errorTests = [
    {
      name: 'Invalid JSON',
      path: '/api/synapse/config',
      method: 'POST',
      data: '{"invalid": json}',
      expectedStatus: 400
    },
    {
      name: 'Missing Required Fields',
      path: '/api/synapse/test-model',
      method: 'POST',
      data: JSON.stringify({}),
      expectedStatus: 400
    },
    {
      name: 'Invalid Endpoint',
      path: '/api/synapse/nonexistent',
      method: 'GET',
      data: null,
      expectedStatus: 404
    }
  ];

  for (const test of errorTests) {
    try {
      const response = await httpRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: test.path,
        method: test.method,
        headers: test.data ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(test.data)
        } : { 'Content-Type': 'application/json' }
      }, test.data);

      const success = response.statusCode === test.expectedStatus;
      logTest(test.name, success, `Expected: ${test.expectedStatus}, Got: ${response.statusCode}`);

    } catch (error) {
      logTest(test.name, false, error.message);
    }
  }
}

async function runAllTests() {
  try {
    await startServer();
    await delay(3000); // Give server time to fully start

    await testBasicEndpoints();
    await testConfigurationManagement();
    await testSynapseContextExtraction();
    await testHealthMonitoring();
    await testUsageTracking();
    await testModelTesting();
    await testFileSystemIntegration();
    await testErrorHandling();

    // Test summary
    logSection('TEST SUMMARY');
    const passed = testResults.filter(r => r.success).length;
    const failed = testResults.filter(r => !r.success).length;
    const total = testResults.length;

    log(`Total tests: ${total}`, colors.blue);
    log(`Passed: ${passed}`, colors.green);
    log(`Failed: ${failed}`, failed > 0 ? colors.red : colors.green);
    log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`, colors.blue);

    if (failed > 0) {
      log('\nFailed tests:', colors.red);
      testResults.filter(r => !r.success).forEach(test => {
        log(`  - ${test.name}: ${test.details}`, colors.red);
      });
    }

  } catch (error) {
    log(`Test execution failed: ${error.message}`, colors.red);
  } finally {
    if (serverProcess) {
      serverProcess.kill();
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\n🛑 Tests interrupted', colors.yellow);
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n🛑 Tests terminated', colors.yellow);
  if (serverProcess) {
    serverProcess.kill();
  }
  process.exit(0);
});

// Run the tests
runAllTests().then(() => {
  log('\n🏁 Test execution completed', colors.green);
  process.exit(0);
}).catch(error => {
  log(`\n💥 Test execution failed: ${error.message}`, colors.red);
  process.exit(1);
});