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

async function testSynapseContexts() {
  console.log('🎯 Testing Synapse Context Extraction...\n');

  const testCases = [
    {
      name: 'Coding Agent',
      headers: {
        'x-synapse-project-id': 'test-project-001',
        'x-synapse-agent-id': 'coding-agent-123',
        'x-synapse-agent-type': 'coding',
        'x-synapse-task-type': 'code-generation',
        'x-synapse-token-estimate': '1500'
      }
    },
    {
      name: 'Analysis Agent',
      headers: {
        'x-synapse-project-id': 'test-project-002',
        'x-synapse-agent-id': 'analysis-agent-456',
        'x-synapse-agent-type': 'analysis',
        'x-synapse-task-type': 'data-analysis',
        'x-synapse-token-estimate': '2000'
      }
    },
    {
      name: 'Reasoning Agent',
      headers: {
        'x-synapse-project-id': 'test-project-003',
        'x-synapse-agent-id': 'reasoning-agent-789',
        'x-synapse-agent-type': 'reasoning',
        'x-synapse-task-type': 'logical-reasoning',
        'x-synapse-token-estimate': '3000'
      }
    },
    {
      name: 'General Agent',
      headers: {
        'x-synapse-project-id': 'test-project-004',
        'x-synapse-agent-id': 'general-agent-101',
        'x-synapse-agent-type': 'general',
        'x-synapse-task-type': 'conversation',
        'x-synapse-token-estimate': '500'
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`Testing ${testCase.name}...`);
    
    try {
      const requestData = JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ 
          role: 'user', 
          content: `Hello from ${testCase.name}` 
        }],
        max_tokens: 5
      });

      const result = await makeRequest('/v1/messages', 'POST', requestData, testCase.headers);
      
      console.log(`✅ ${testCase.name}: ${result.statusCode}`);
      
      // Log the first part of the response to see what's happening
      if (result.data) {
        const preview = result.data.substring(0, 150);
        console.log(`   Response: ${preview}${result.data.length > 150 ? '...' : ''}`);
      }
      
      // Check if we can see any evidence of context processing
      if (result.data.includes('synapse') || result.data.includes('context')) {
        console.log(`   🎯 Context processing detected!`);
      }
      
    } catch (error) {
      console.log(`❌ ${testCase.name}: ${error.message}`);
    }
    
    console.log(); // Add spacing between tests
  }

  // Test without context headers (should use default routing)
  console.log('Testing without Synapse context (default routing)...');
  
  try {
    const requestData = JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ 
        role: 'user', 
        content: 'Hello without context' 
      }],
      max_tokens: 5
    });

    const result = await makeRequest('/v1/messages', 'POST', requestData);
    
    console.log(`✅ Default routing: ${result.statusCode}`);
    
    if (result.data) {
      const preview = result.data.substring(0, 150);
      console.log(`   Response: ${preview}${result.data.length > 150 ? '...' : ''}`);
    }
    
  } catch (error) {
    console.log(`❌ Default routing: ${error.message}`);
  }
}

testSynapseContexts().catch(console.error);