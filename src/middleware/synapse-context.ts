import { Request } from 'express';

export interface SynapseContext {
  projectId?: string;
  agentId?: string;
  agentType?: 'coding' | 'analysis' | 'reasoning' | 'general';
  taskType?: string;
  estimatedTokens?: number;
  costLimits?: {
    daily?: number;
    monthly?: number;
  };
}

export interface RouterConfig {
  models: {
    default: string;
    coder: string;
    tool: string;
    think: string;
    fast: string;
    longContext: string;
  };
  providers: {
    [key: string]: {
      apiKey: string;
      baseUrl: string;
      models: string[];
    };
  };
  routing: {
    enabled: boolean;
    fallbackEnabled: boolean;
    retryAttempts: number;
  };
  monitoring: {
    usageTracking: boolean;
    healthChecks: boolean;
    costTracking: boolean;
  };
}

export class SynapseContextMiddleware {
  extractContext(req: Request): SynapseContext {
    return {
      projectId: req.headers['x-synapse-project-id'] as string,
      agentId: req.headers['x-synapse-agent-id'] as string,
      agentType: req.headers['x-synapse-agent-type'] as any,
      taskType: req.headers['x-synapse-task-type'] as string,
      estimatedTokens: parseInt(req.headers['x-synapse-token-estimate'] as string || '0'),
      costLimits: this.parseCostLimits(req.headers['x-synapse-cost-limits'] as string)
    };
  }

  routeBasedOnContext(context: SynapseContext, config: RouterConfig): string {
    if (context.agentType) {
      const modelMap = {
        'coding': config.models.coder || 'deepseek-chat',
        'analysis': config.models.tool || 'qwen-max-2025-01-25',
        'reasoning': config.models.think || 'deepseek-reasoner',
        'general': config.models.default || 'claude-3-5-sonnet-20241022'
      };

      return modelMap[context.agentType] || modelMap.general;
    }

    if (context.estimatedTokens) {
      if (context.estimatedTokens > 50000) {
        return config.models.longContext || 'claude-3-5-sonnet-20241022';
      }
      if (context.estimatedTokens < 1000) {
        return config.models.fast || 'claude-3-5-haiku-20241022';
      }
    }

    return config.models.default || 'claude-3-5-sonnet-20241022';
  }

  private parseCostLimits(costLimitsHeader: string): { daily?: number; monthly?: number } | undefined {
    if (!costLimitsHeader) return undefined;
    
    try {
      return JSON.parse(costLimitsHeader);
    } catch (error) {
      console.warn('Failed to parse cost limits header:', error);
      return undefined;
    }
  }
}