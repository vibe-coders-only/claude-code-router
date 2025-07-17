import { Request, Response } from 'express';
import { RouterConfig } from '../middleware/synapse-context';
import { HealthMonitor } from '../middleware/health-monitoring';
import { UsageTracker, UsageFilters } from '../middleware/usage-tracking';
import * as fs from 'fs';
import * as path from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ModelTestResult {
  success: boolean;
  latency?: number;
  error?: string;
  model: string;
  provider: string;
}

export class SynapseAPI {
  private configPath: string;
  private healthMonitor: HealthMonitor;
  private usageTracker: UsageTracker;

  constructor(
    healthMonitor: HealthMonitor,
    usageTracker: UsageTracker,
    configPath?: string
  ) {
    this.healthMonitor = healthMonitor;
    this.usageTracker = usageTracker;
    
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    this.configPath = configPath || path.join(homeDir, '.claude-code-router', 'synapse-config.json');
    this.ensureConfigDirectory();
  }

  private ensureConfigDirectory(): void {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async getConfig(req: any, res: any): Promise<void> {
    try {
      const config = await this.loadConfig();
      return res.code(200).send({ success: true, config });
    } catch (error: any) {
      return res.code(500).send({ 
        success: false, 
        error: 'Failed to load configuration',
        details: error.message
      });
    }
  }

  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { models, providers, routing, monitoring } = req.body;
      const configUpdate = { models, providers, routing, monitoring };

      const validation = this.validateConfig(configUpdate);
      if (!validation.valid) {
        res.status(400).json({ 
          success: false, 
          error: 'Invalid configuration',
          details: validation.errors
        });
        return;
      }

      await this.saveConfig(configUpdate);
      res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update configuration',
        details: error.message
      });
    }
  }

  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const config = await this.loadConfig();
      
      // Check health of all providers
      await this.healthMonitor.checkAllProviders(config.providers);
      
      const health = this.healthMonitor.getOverallHealth();
      res.json({ success: true, health });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get health status',
        details: error.message
      });
    }
  }

  async getUsage(req: Request, res: Response): Promise<void> {
    try {
      const { projectId, agentId, timeRange } = req.query;
      
      const filters: UsageFilters = {
        projectId: projectId as string,
        agentId: agentId as string,
        timeRange: timeRange ? JSON.parse(timeRange as string) : undefined
      };

      const usage = await this.usageTracker.getUsageStats(filters);
      res.json({ success: true, usage });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get usage statistics',
        details: error.message
      });
    }
  }

  async testModel(req: Request, res: Response): Promise<void> {
    try {
      const { provider, model } = req.body;
      
      if (!provider || !model) {
        res.status(400).json({ 
          success: false, 
          error: 'Provider and model are required' 
        });
        return;
      }

      const config = await this.loadConfig();
      const providerConfig = config.providers[provider];
      
      if (!providerConfig) {
        res.status(404).json({ 
          success: false, 
          error: `Provider ${provider} not found` 
        });
        return;
      }

      const result = await this.testModelConnection(provider, model, providerConfig);
      res.json({ success: true, result });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to test model connection',
        details: error.message
      });
    }
  }

  async loadConfig(): Promise<RouterConfig> {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
      
      // Return default configuration if file doesn't exist
      return this.getDefaultConfig();
    } catch (error) {
      console.error('Failed to load config, using defaults:', error);
      return this.getDefaultConfig();
    }
  }

  async saveConfig(config: Partial<RouterConfig>): Promise<void> {
    try {
      const currentConfig = await this.loadConfig();
      const updatedConfig = { ...currentConfig, ...config };
      
      fs.writeFileSync(this.configPath, JSON.stringify(updatedConfig, null, 2));
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  validateConfig(config: Partial<RouterConfig>): ValidationResult {
    const errors: string[] = [];

    // Validate models
    if (config.models) {
      const requiredModels = ['default', 'coder', 'tool', 'think', 'fast', 'longContext'];
      for (const model of requiredModels) {
        if (!config.models[model as keyof typeof config.models]) {
          errors.push(`Missing required model: ${model}`);
        }
      }
    }

    // Validate providers
    if (config.providers) {
      for (const [providerName, providerConfig] of Object.entries(config.providers)) {
        if (!providerConfig.apiKey) {
          errors.push(`Missing API key for provider: ${providerName}`);
        }
        if (!providerConfig.baseUrl) {
          errors.push(`Missing base URL for provider: ${providerName}`);
        }
        if (!providerConfig.models || !Array.isArray(providerConfig.models)) {
          errors.push(`Invalid models array for provider: ${providerName}`);
        }
      }
    }

    // Validate routing
    if (config.routing) {
      if (typeof config.routing.enabled !== 'boolean') {
        errors.push('routing.enabled must be a boolean');
      }
      if (typeof config.routing.fallbackEnabled !== 'boolean') {
        errors.push('routing.fallbackEnabled must be a boolean');
      }
      if (typeof config.routing.retryAttempts !== 'number' || config.routing.retryAttempts < 0) {
        errors.push('routing.retryAttempts must be a non-negative number');
      }
    }

    // Validate monitoring
    if (config.monitoring) {
      const booleanFields = ['usageTracking', 'healthChecks', 'costTracking'];
      for (const field of booleanFields) {
        if (typeof config.monitoring[field as keyof typeof config.monitoring] !== 'boolean') {
          errors.push(`monitoring.${field} must be a boolean`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private async testModelConnection(provider: string, model: string, providerConfig: any): Promise<ModelTestResult> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${providerConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'Test message' }],
          max_tokens: 10
        })
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          model,
          provider,
          latency
        };
      }

      return {
        success: true,
        model,
        provider,
        latency
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        model,
        provider,
        latency: Date.now() - startTime
      };
    }
  }

  private getDefaultConfig(): RouterConfig {
    return {
      models: {
        default: 'claude-3-5-sonnet-20241022',
        coder: 'deepseek-chat',
        tool: 'qwen-max-2025-01-25',
        think: 'deepseek-reasoner',
        fast: 'claude-3-5-haiku-20241022',
        longContext: 'claude-3-5-sonnet-20241022'
      },
      providers: {
        openrouter: {
          apiKey: process.env.OPENROUTER_API_KEY || '',
          baseUrl: 'https://openrouter.ai/api/v1',
          models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
        }
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
    };
  }
}