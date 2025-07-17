import { Request, Response } from 'express';
import { SynapseContextMiddleware, SynapseContext } from '../middleware/synapse-context';
import { UsageTracker } from '../middleware/usage-tracking';
import { HealthMonitor, FallbackManager } from '../middleware/health-monitoring';
import { SynapseAPI } from '../api/synapse-endpoints';

export class EnhancedRouter {
  private synapseContext: SynapseContextMiddleware;
  private usageTracker: UsageTracker;
  private healthMonitor: HealthMonitor;
  private fallbackManager: FallbackManager;
  private synapseAPI: SynapseAPI;

  constructor() {
    this.synapseContext = new SynapseContextMiddleware();
    this.usageTracker = new UsageTracker();
    this.healthMonitor = new HealthMonitor();
    this.fallbackManager = new FallbackManager(this.healthMonitor);
    this.synapseAPI = new SynapseAPI(this.healthMonitor, this.usageTracker);
  }

  async routeRequest(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    let context: SynapseContext = {};
    
    try {
      // Extract context from request headers
      context = this.synapseContext.extractContext(req);
      
      // Load configuration
      const config = await this.synapseAPI.loadConfig();
      
      // Skip enhanced routing if disabled
      if (!config.routing.enabled) {
        await this.fallbackToOriginalRouter(req, res);
        return;
      }

      // Determine target model based on context
      const targetModel = this.synapseContext.routeBasedOnContext(context, config);
      
      // Route with fallback support
      const response = await this.fallbackManager.routeWithFallback(
        req.body || {},
        context,
        targetModel,
        config.providers,
        config.routing.retryAttempts
      );

      // Add timing information
      response.totalLatency = Date.now() - startTime;

      // Track usage if enabled
      if (config.monitoring.usageTracking) {
        await this.usageTracker.trackRequest(context, response);
      }

      // Return response
      res.json(response);

    } catch (error: any) {
      const errorResponse = {
        success: false,
        error: error.message,
        model: 'unknown',
        provider: 'unknown',
        totalLatency: Date.now() - startTime
      };

      // Track failure if usage tracking is enabled
      try {
        const config = await this.synapseAPI.loadConfig();
        if (config.monitoring.usageTracking) {
          await this.usageTracker.trackRequest(context, errorResponse);
        }
      } catch (trackingError) {
        console.error('Failed to track error:', trackingError);
      }

      console.error('Enhanced router error:', error);
      res.status(500).json(errorResponse);
    }
  }

  async handleHealthCheck(req: any, res: any): Promise<void> {
    try {
      console.log('Health check called');
      const config = await this.synapseAPI.loadConfig();
      console.log('Config loaded:', !!config);
      
      if (config.monitoring && config.monitoring.healthChecks) {
        await this.healthMonitor.checkAllProviders(config.providers);
      }
      
      const health = this.healthMonitor.getOverallHealth();
      console.log('Health check result:', health);
      return res.code(200).send({ success: true, health });
    } catch (error: any) {
      console.error('Health check error:', error);
      return res.code(500).send({ 
        success: false, 
        error: 'Health check failed',
        details: error.message
      });
    }
  }

  async handleUsageStats(req: any, res: any): Promise<void> {
    try {
      const { projectId, agentId, timeRange } = req.query;
      
      const filters = {
        projectId: projectId as string,
        agentId: agentId as string,
        timeRange: timeRange ? JSON.parse(timeRange as string) : undefined
      };

      const usage = await this.usageTracker.getUsageStats(filters);
      return res.code(200).send({ success: true, usage });
    } catch (error: any) {
      return res.code(500).send({ 
        success: false, 
        error: 'Failed to get usage statistics',
        details: error.message
      });
    }
  }

  async handleConfigGet(req: any, res: any): Promise<void> {
    await this.synapseAPI.getConfig(req, res);
  }

  async handleConfigUpdate(req: any, res: any): Promise<void> {
    await this.synapseAPI.updateConfig(req, res);
  }

  async handleModelTest(req: any, res: any): Promise<void> {
    await this.synapseAPI.testModel(req, res);
  }

  // Fallback to original router functionality
  private async fallbackToOriginalRouter(req: Request, res: Response): Promise<void> {
    // This would integrate with the existing claude-code-router logic
    // For now, we'll just return a simple response
    res.json({
      success: true,
      message: 'Fallback to original router (not implemented)',
      routingReason: 'enhanced_routing_disabled'
    });
  }

  // Middleware function to extract and validate Synapse context
  extractSynapseContext() {
    return (req: Request, res: Response) => {
      try {
        const context = this.synapseContext.extractContext(req);
        
        // Attach context to request for later use
        (req as any).synapseContext = context;
        
      } catch (error) {
        console.error('Failed to extract Synapse context:', error);
        // Continue anyway - context is optional
      }
    };
  }

  // Middleware function to check provider health
  checkProviderHealth() {
    return async (req: Request, res: Response) => {
      try {
        const config = await this.synapseAPI.loadConfig();
        
        if (config.monitoring.healthChecks) {
          // Run health checks in background
          this.healthMonitor.checkAllProviders(config.providers).catch(error => {
            console.error('Background health check failed:', error);
          });
        }
        
      } catch (error) {
        console.error('Health check middleware failed:', error);
        // Continue anyway - health checks are optional
      }
    };
  }

  // Middleware function to track usage
  trackUsage() {
    return async (req: Request, res: Response) => {
      const originalJson = res.json;
      const startTime = Date.now();
      
      res.json = function(data: any) {
        // Track the response
        if (data && typeof data === 'object') {
          const context = (req as any).synapseContext || {};
          const responseWithTiming = {
            ...data,
            latency: Date.now() - startTime
          };
          
          // Track usage asynchronously
          this.usageTracker.trackRequest(context, responseWithTiming).catch(error => {
            console.error('Failed to track usage:', error);
          });
        }
        
        return originalJson.call(this, data);
      }.bind(this);
    };
  }

  // Get the health monitor instance
  getHealthMonitor(): HealthMonitor {
    return this.healthMonitor;
  }

  // Get the usage tracker instance
  getUsageTracker(): UsageTracker {
    return this.usageTracker;
  }

  // Get the Synapse API instance
  getSynapseAPI(): SynapseAPI {
    return this.synapseAPI;
  }

  // Cleanup method
  cleanup(): void {
    this.healthMonitor.stopPeriodicHealthChecks();
  }
}