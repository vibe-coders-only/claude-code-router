#!/usr/bin/env node

const http = require('http');

function makeRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3456,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: responseData
        });
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

async function testConfigManagement() {
  console.log('⚙️ Testing Configuration Management...\n');

  // Test 1: Get current configuration
  try {
    const result = await makeRequest('/api/synapse/config');
    console.log(`✅ Get Config: ${result.statusCode}`);
    
    if (result.data) {
      const parsed = JSON.parse(result.data);
      console.log(`   Success: ${parsed.success}`);
      if (parsed.config) {
        console.log(`   Models: ${Object.keys(parsed.config.models || {}).join(', ')}`);
        console.log(`   Providers: ${Object.keys(parsed.config.providers || {}).join(', ')}`);
        console.log(`   Routing enabled: ${parsed.config.routing?.enabled}`);
      }
    }
  } catch (error) {
    console.log(`❌ Get Config: ${error.message}`);
  }

  // Test 2: Update configuration
  console.log('\n📝 Testing config update...');
  
  try {
    const updateData = JSON.stringify({
      models: {
        default: 'claude-3-5-sonnet-20241022',
        coder: 'deepseek-chat',
        test: 'test-model-updated'
      },
      routing: {
        enabled: true,
        fallbackEnabled: true,
        retryAttempts: 3
      },
      monitoring: {
        usageTracking: true,
        healthChecks: true,
        costTracking: true
      }
    });

    const result = await makeRequest('/api/synapse/config', 'POST', updateData);
    console.log(`✅ Update Config: ${result.statusCode}`);
    
    if (result.data) {
      const parsed = JSON.parse(result.data);
      console.log(`   Success: ${parsed.success}`);
      if (parsed.message) {
        console.log(`   Message: ${parsed.message}`);
      }
    }
  } catch (error) {
    console.log(`❌ Update Config: ${error.message}`);
  }

  // Test 3: Test invalid configuration
  console.log('\n❌ Testing invalid config...');
  
  try {
    const invalidData = JSON.stringify({
      models: null, // Invalid
      routing: {
        enabled: "not-a-boolean" // Invalid
      }
    });

    const result = await makeRequest('/api/synapse/config', 'POST', invalidData);
    console.log(`✅ Invalid Config Rejected: ${result.statusCode}`);
    
    if (result.data) {
      const parsed = JSON.parse(result.data);
      console.log(`   Success: ${parsed.success}`);
      if (parsed.error) {
        console.log(`   Error: ${parsed.error}`);
      }
    }
  } catch (error) {
    console.log(`❌ Invalid Config Test: ${error.message}`);
  }

  // Test 4: Test model connectivity
  console.log('\n🔌 Testing model connectivity...');
  
  try {
    const testData = JSON.stringify({
      provider: 'openrouter',
      model: 'claude-3-5-sonnet-20241022'
    });

    const result = await makeRequest('/api/synapse/test-model', 'POST', testData);
    console.log(`✅ Model Test: ${result.statusCode}`);
    
    if (result.data) {
      const parsed = JSON.parse(result.data);
      console.log(`   Success: ${parsed.success}`);
      if (parsed.result) {
        console.log(`   Model success: ${parsed.result.success}`);
        if (parsed.result.latency) {
          console.log(`   Latency: ${parsed.result.latency}ms`);
        }
      }
    }
  } catch (error) {
    console.log(`❌ Model Test: ${error.message}`);
  }
}

testConfigManagement().catch(console.error);