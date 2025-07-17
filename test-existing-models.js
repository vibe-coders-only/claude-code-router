#!/usr/bin/env node

const http = require('http');

function makeRequest(path, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3456,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
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

async function testExistingModels() {
  console.log('🧪 Testing with existing models...\n');

  // Test models that we know exist in the system
  const testCases = [
    {
      name: 'Coding Agent with DeepSeek',
      model: 'deepseek-chat',
      headers: {
        'x-synapse-project-id': 'test-project-001',
        'x-synapse-agent-id': 'coding-agent-123',
        'x-synapse-agent-type': 'coding',
        'x-synapse-task-type': 'code-generation',
        'x-synapse-token-estimate': '1500'
      }
    },
    {
      name: 'Analysis Agent with DeepSeek',
      model: 'deepseek-chat',
      headers: {
        'x-synapse-project-id': 'test-project-002',
        'x-synapse-agent-id': 'analysis-agent-456',
        'x-synapse-agent-type': 'analysis',
        'x-synapse-task-type': 'data-analysis',
        'x-synapse-token-estimate': '2000'
      }
    },
    {
      name: 'Reasoning Agent with DeepSeek Reasoner',
      model: 'deepseek-reasoner',
      headers: {
        'x-synapse-project-id': 'test-project-003',
        'x-synapse-agent-id': 'reasoning-agent-789',
        'x-synapse-agent-type': 'reasoning',
        'x-synapse-task-type': 'logical-reasoning',
        'x-synapse-token-estimate': '3000'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing ${testCase.name}...`);
    
    try {
      const requestData = JSON.stringify({
        model: testCase.model,
        messages: [{ 
          role: 'user', 
          content: `Hello from ${testCase.name}. Please respond with exactly: "SUCCESS: ${testCase.headers['x-synapse-agent-type']} agent working"` 
        }],
        max_tokens: 20
      });

      const result = await makeRequest('/v1/messages', 'POST', requestData, testCase.headers);
      
      console.log(`✅ ${testCase.name}: ${result.statusCode}`);
      
      if (result.data) {
        try {
          const response = JSON.parse(result.data);
          if (response.content && response.content[0] && response.content[0].text) {
            console.log(`   Response: ${response.content[0].text}`);
            console.log(`   Model used: ${response.model}`);
          }
        } catch (e) {
          const preview = result.data.substring(0, 100);
          console.log(`   Raw response: ${preview}...`);
        }
      }
      
    } catch (error) {
      console.log(`❌ ${testCase.name}: ${error.message}`);
    }
    
    console.log();
  }

  // Test default routing (no Synapse context)
  console.log('Testing default routing (no Synapse context)...');
  
  try {
    const requestData = JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ 
        role: 'user', 
        content: 'Hello default routing. Please respond with exactly: "SUCCESS: default routing working"' 
      }],
      max_tokens: 20
    });

    const result = await makeRequest('/v1/messages', 'POST', requestData);
    
    console.log(`✅ Default routing: ${result.statusCode}`);
    
    if (result.data) {
      try {
        const response = JSON.parse(result.data);
        if (response.content && response.content[0] && response.content[0].text) {
          console.log(`   Response: ${response.content[0].text}`);
          console.log(`   Model used: ${response.model}`);
        }
      } catch (e) {
        const preview = result.data.substring(0, 100);
        console.log(`   Raw response: ${preview}...`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Default routing: ${error.message}`);
  }
}

testExistingModels().catch(console.error);