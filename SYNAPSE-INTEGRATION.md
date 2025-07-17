# Synapse IDE Integration for Claude Code Router

This document describes the enhanced features added to claude-code-router for integration with Synapse IDE.

## Features Overview

### 🎯 Context-Aware Routing
- **Agent-Type Based Routing**: Routes requests to optimal models based on agent type (coding, analysis, reasoning, general)
- **Token-Based Routing**: Automatically selects appropriate models based on estimated token count
- **Cost-Aware Routing**: Considers cost limits and optimization preferences

### 📊 Usage Tracking & Analytics
- **Comprehensive Usage Metrics**: Track tokens, costs, latency, and success rates
- **Project & Agent Filtering**: Filter usage statistics by project ID, agent ID, and time ranges
- **Export Capabilities**: Access usage data via REST API for external analytics

### 🔄 Health Monitoring & Fallback
- **Provider Health Checks**: Continuous monitoring of all configured providers
- **Automatic Fallback**: Seamless failover to healthy providers when issues occur
- **Performance Metrics**: Track latency, error rates, and provider availability

### ⚙️ Configuration Management
- **Dynamic Configuration**: Update routing rules and provider settings without restart
- **Validation**: Comprehensive config validation with detailed error messages
- **Model Testing**: Test connectivity to specific models before deployment

## API Endpoints

### Configuration Management
```bash
# Get current configuration
GET /api/synapse/config

# Update configuration
POST /api/synapse/config
Content-Type: application/json
{
  "models": {
    "default": "claude-3-5-sonnet-20241022",
    "coder": "deepseek-chat",
    "tool": "qwen-max-2025-01-25",
    "think": "deepseek-reasoner"
  },
  "providers": {
    "deepseek": {
      "apiKey": "sk-deepseek-your-key",
      "baseUrl": "https://api.deepseek.com",
      "models": ["deepseek-chat", "deepseek-reasoner"]
    }
  }
}
```

### Health Monitoring
```bash
# Get overall system health
GET /api/synapse/health

# Response:
{
  "success": true,
  "health": {
    "healthy": true,
    "score": 0.95,
    "providers": [...],
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

### Usage Analytics
```bash
# Get usage statistics
GET /api/synapse/usage?projectId=proj-123&timeRange={"start":"2024-01-01","end":"2024-01-31"}

# Response:
{
  "success": true,
  "usage": {
    "totalRequests": 1250,
    "totalTokens": 2500000,
    "totalCost": 45.67,
    "averageLatency": 1200,
    "successRate": 0.98,
    "modelBreakdown": {...},
    "agentBreakdown": {...}
  }
}
```

### Model Testing
```bash
# Test specific model connectivity
POST /api/synapse/test-model
Content-Type: application/json
{
  "provider": "deepseek",
  "model": "deepseek-chat"
}

# Response:
{
  "success": true,
  "result": {
    "success": true,
    "latency": 850,
    "model": "deepseek-chat",
    "provider": "deepseek"
  }
}
```

## Synapse Context Headers

When making requests to the router, include these headers for enhanced routing:

```http
x-synapse-project-id: project-123
x-synapse-agent-id: agent-456
x-synapse-agent-type: coding
x-synapse-task-type: code-generation
x-synapse-token-estimate: 1500
x-synapse-cost-limits: {"daily": 10.0, "monthly": 200.0}
```

### Agent Types
- `coding`: For code generation and programming tasks
- `analysis`: For data analysis and reasoning tasks
- `reasoning`: For complex logical reasoning (uses thinking models)
- `general`: For general-purpose conversations

## Configuration

### Basic Configuration
Copy `config/synapse-config.example.json` to `~/.claude-code-router/synapse-config.json` and customize:

```json
{
  "models": {
    "default": "claude-3-5-sonnet-20241022",
    "coder": "deepseek-chat",
    "tool": "qwen-max-2025-01-25",
    "think": "deepseek-reasoner",
    "fast": "claude-3-5-haiku-20241022",
    "longContext": "claude-3-5-sonnet-20241022"
  },
  "providers": {
    "deepseek": {
      "apiKey": "sk-deepseek-your-key",
      "baseUrl": "https://api.deepseek.com",
      "models": ["deepseek-chat", "deepseek-reasoner"]
    }
  },
  "routing": {
    "enabled": true,
    "fallbackEnabled": true,
    "retryAttempts": 3
  },
  "monitoring": {
    "usageTracking": true,
    "healthChecks": true,
    "costTracking": true
  }
}
```

### Advanced Configuration
The configuration supports additional features:

```json
{
  "agentMapping": {
    "coding": {
      "primaryModel": "deepseek-chat",
      "fallbackModels": ["claude-3-5-sonnet-20241022"],
      "contextWindow": 32768,
      "temperature": 0.1
    }
  },
  "costLimits": {
    "global": {"daily": 100.0, "monthly": 2000.0},
    "perProject": {"daily": 50.0, "monthly": 1000.0}
  },
  "routing": {
    "loadBalancing": {"enabled": true, "strategy": "round_robin"},
    "costOptimization": {"enabled": true, "preferCheaperModels": true}
  }
}
```

## Usage Examples

### 1. Basic Setup
```bash
# Start the router
ccr start

# Test with Synapse context
curl -X POST http://localhost:3456/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-synapse-agent-type: coding" \
  -H "x-synapse-project-id: my-project" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Write a Python function to sort a list"}],
    "max_tokens": 1000
  }'
```

### 2. Monitor Health
```bash
# Check system health
curl http://localhost:3456/api/synapse/health

# Get usage statistics
curl "http://localhost:3456/api/synapse/usage?projectId=my-project"
```

### 3. Update Configuration
```bash
# Add new provider
curl -X POST http://localhost:3456/api/synapse/config \
  -H "Content-Type: application/json" \
  -d '{
    "providers": {
      "new-provider": {
        "apiKey": "your-key",
        "baseUrl": "https://api.example.com",
        "models": ["model-1", "model-2"]
      }
    }
  }'
```

## File Structure

```
src/
├── middleware/
│   ├── synapse-context.ts      # Context extraction and routing logic
│   ├── usage-tracking.ts       # Usage analytics and storage
│   └── health-monitoring.ts    # Health checks and fallback management
├── api/
│   └── synapse-endpoints.ts    # REST API endpoints
├── utils/
│   ├── enhanced-router.ts      # Main enhanced router class
│   └── synapse-logger.ts       # Logging utilities
├── types/
│   └── synapse-types.ts        # TypeScript type definitions
└── config/
    └── synapse-config.example.json  # Example configuration
```

## Development

### Running Tests
```bash
# Run integration tests
node test-synapse-integration.js

# Build and test
npm run build
npm test
```

### Adding New Providers
1. Update the configuration with provider details
2. Add models to the provider's model list
3. Test connectivity using the `/api/synapse/test-model` endpoint
4. Update agent mappings if needed

### Debugging
- Check logs in `~/.claude-code-router/synapse.log`
- Enable debug logging by setting log level to DEBUG
- Use the health endpoint to check provider status
- Monitor usage patterns via the usage API

## Security Considerations

- Store API keys securely (consider using environment variables)
- Enable rate limiting for production deployments
- Regularly rotate API keys
- Monitor usage to detect anomalies
- Use HTTPS in production environments

## Troubleshooting

### Common Issues

1. **Provider Connection Failures**
   - Check API keys and base URLs
   - Verify network connectivity
   - Test individual models via test endpoint

2. **High Latency**
   - Review provider health metrics
   - Consider adjusting retry attempts
   - Check for network issues

3. **Configuration Errors**
   - Validate JSON syntax
   - Check required fields
   - Use the config validation endpoint

4. **Usage Tracking Not Working**
   - Verify monitoring settings are enabled
   - Check file permissions in `~/.claude-code-router/`
   - Review logs for error messages

### Support

For issues specific to Synapse integration:
1. Check the logs in `~/.claude-code-router/synapse.log`
2. Verify configuration using the API endpoints
3. Test individual components using the provided test script
4. Review the health monitoring output for system status

## Future Enhancements

- Real-time usage dashboards
- Advanced cost optimization algorithms
- Machine learning-based routing decisions
- Integration with external monitoring systems
- Plugin system for custom providers
- A/B testing framework for model selection