#!/usr/bin/env node

const http = require('http');

function testEndpoint(path, method = 'GET', data = null) {
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

async function runTests() {
  console.log('🧪 Testing Synapse endpoints...\n');

  const tests = [
    { name: 'Health Check', path: '/api/synapse/health' },
    { name: 'Configuration', path: '/api/synapse/config' },
    { name: 'Usage Stats', path: '/api/synapse/usage' },
  ];

  for (const test of tests) {
    try {
      const result = await testEndpoint(test.path);
      console.log(`✅ ${test.name}: ${result.statusCode}`);
      
      if (result.data) {
        try {
          const parsed = JSON.parse(result.data);
          console.log(`   Success: ${parsed.success}`);
          if (parsed.config) {
            console.log(`   Config sections: ${Object.keys(parsed.config).join(', ')}`);
          }
          if (parsed.health) {
            console.log(`   Health: ${parsed.health.healthy} (score: ${parsed.health.score})`);
          }
          if (parsed.usage) {
            console.log(`   Usage: ${parsed.usage.totalRequests} requests`);
          }
        } catch (e) {
          console.log(`   Raw response: ${result.data.substring(0, 100)}...`);
        }
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }

  // Test Synapse context headers
  console.log('\n🔍 Testing Synapse context...\n');
  
  try {
    const requestData = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'Hello test' }],
      max_tokens: 5
    });

    const result = await testEndpoint('/v1/messages', 'POST', requestData);
    console.log(`✅ Synapse Context: ${result.statusCode}`);
    
    if (result.data) {
      console.log(`   Response: ${result.data.substring(0, 100)}...`);
    }
  } catch (error) {
    console.log(`❌ Synapse Context: ${error.message}`);
  }
}

runTests().catch(console.error);