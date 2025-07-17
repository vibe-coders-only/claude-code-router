import Server from "@musistudio/llms";
import { EnhancedRouter } from "./utils/enhanced-router";

export const createServer = (config: any): Server => {
  const server = new Server(config);
  
  // Initialize enhanced router for Synapse integration
  const enhancedRouter = new EnhancedRouter();
  
  // Register Synapse endpoints as a plugin with higher priority
  console.log('Registering Synapse API endpoints...');
  
  server.app.register(async function (fastify) {
    // Simple test endpoint first
    fastify.get('/api/synapse/test', async (request, reply) => {
      console.log('Test endpoint hit');
      return reply.code(200).send({ success: true, message: 'Test endpoint working' });
    });
    
    fastify.get('/api/synapse/config', enhancedRouter.handleConfigGet.bind(enhancedRouter));
    fastify.post('/api/synapse/config', enhancedRouter.handleConfigUpdate.bind(enhancedRouter));
    fastify.get('/api/synapse/health', enhancedRouter.handleHealthCheck.bind(enhancedRouter));
    fastify.get('/api/synapse/usage', enhancedRouter.handleUsageStats.bind(enhancedRouter));
    fastify.post('/api/synapse/test-model', enhancedRouter.handleModelTest.bind(enhancedRouter));
  });
  
  console.log('Synapse API endpoints registered');
  
  // Add simple context extraction middleware (no blocking)
  server.addHook('preHandler', async (request, reply) => {
    try {
      // Extract Synapse context from headers
      const context = {
        projectId: request.headers['x-synapse-project-id'] as string,
        agentId: request.headers['x-synapse-agent-id'] as string,
        agentType: request.headers['x-synapse-agent-type'] as string,
        taskType: request.headers['x-synapse-task-type'] as string,
        estimatedTokens: parseInt(request.headers['x-synapse-token-estimate'] as string || '0')
      };
      (request as any).synapseContext = context;
    } catch (error) {
      console.error('Context extraction error:', error);
    }
  });
  
  // Store enhanced router instance for cleanup
  (server as any)._enhancedRouter = enhancedRouter;
  
  return server;
};
