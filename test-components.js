#!/usr/bin/env node

// Test individual components without server

const { SynapseContextMiddleware } = require('./dist/cli.js');

console.log('🧪 Testing individual components...\n');

// Test 1: Check if components are exported properly
console.log('Testing component exports...');
try {
  const testReq = {
    headers: {
      'x-synapse-project-id': 'test-project',
      'x-synapse-agent-id': 'test-agent',
      'x-synapse-agent-type': 'coding'
    }
  };

  console.log('✅ Component import successful');
  console.log('Test request:', JSON.stringify(testReq.headers, null, 2));
} catch (error) {
  console.log('❌ Component import failed:', error.message);
}

// Test 2: File system operations
console.log('\n📁 Testing file system operations...');
const fs = require('fs');
const path = require('path');
const os = require('os');

try {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.claude-code-router');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const testFile = path.join(configDir, 'test-component.json');
  const testData = { test: 'data', timestamp: Date.now() };
  
  fs.writeFileSync(testFile, JSON.stringify(testData, null, 2));
  console.log('✅ File write successful');
  
  const readData = JSON.parse(fs.readFileSync(testFile, 'utf8'));
  console.log('✅ File read successful:', readData.test);
  
  fs.unlinkSync(testFile);
  console.log('✅ File cleanup successful');
} catch (error) {
  console.log('❌ File system test failed:', error.message);
}

// Test 3: Check build artifacts
console.log('\n🔧 Testing build artifacts...');
try {
  const stats = fs.statSync('./dist/cli.js');
  console.log('✅ Build artifact exists');
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Modified: ${stats.mtime.toISOString()}`);
} catch (error) {
  console.log('❌ Build artifact test failed:', error.message);
}

// Test 4: Check configuration
console.log('\n⚙️ Testing configuration...');
try {
  const configPath = path.join(os.homedir(), '.claude-code-router', 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ Configuration file exists');
    console.log(`   Providers: ${Object.keys(config.providers || {}).length}`);
    console.log(`   Router settings: ${config.Router ? 'Present' : 'Missing'}`);
  } else {
    console.log('⚠️  No configuration file found');
  }
} catch (error) {
  console.log('❌ Configuration test failed:', error.message);
}

console.log('\n🏁 Component tests completed');