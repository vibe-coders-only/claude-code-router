export interface HealthStatus {
  healthy: boolean;
  latency: number;
  status?: number;
  error?: string;
  lastCheck: Date;
  provider: string;
}

export interface OverallHealth {
  healthy: boolean;
  score: number;
  providers: HealthStatus[];
  lastUpdated: Date;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  models: string[];
}

export class HealthMonitor {
  private healthStatus = new Map<string, HealthStatus>();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(private autoCheckIntervalMs: number = 30000) {
    this.startPeriodicHealthChecks();
  }

  async checkProviderHealth(provider: string, config: ProviderConfig): Promise<HealthStatus> {
    const startTime = Date.now();

    try {
      // Create a controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${config.baseUrl}/health`, {
        headers: { 
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const status: HealthStatus = {
        healthy: response.ok,
        latency: Date.now() - startTime,
        status: response.status,
        lastCheck: new Date(),
        provider
      };

      this.healthStatus.set(provider, status);
      return status;
    } catch (error: any) {
      const status: HealthStatus = {
        healthy: false,
        latency: Date.now() - startTime,
        error: error.message || 'Unknown error',
        lastCheck: new Date(),
        provider
      };

      this.healthStatus.set(provider, status);
      return status;
    }
  }

  async checkAllProviders(providersConfig: { [key: string]: ProviderConfig }): Promise<HealthStatus[]> {
    const promises = Object.entries(providersConfig).map(([provider, config]) =>
      this.checkProviderHealth(provider, config)
    );

    return Promise.all(promises);
  }

  getOverallHealth(): OverallHealth {
    const providers = Array.from(this.healthStatus.values());
    const healthyProviders = providers.filter(p => p.healthy);

    return {
      healthy: healthyProviders.length > 0,
      score: providers.length > 0 ? healthyProviders.length / providers.length : 0,
      providers: providers,
      lastUpdated: new Date()
    };
  }

  getProviderHealth(provider: string): HealthStatus | undefined {
    return this.healthStatus.get(provider);
  }

  private startPeriodicHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      // This would need to be called with actual provider configs
      // For now, we'll just update the lastCheck timestamp for existing providers
      for (const [provider, status] of this.healthStatus.entries()) {
        if (Date.now() - status.lastCheck.getTime() > this.autoCheckIntervalMs * 2) {
          // Mark as stale if no recent checks
          this.healthStatus.set(provider, {
            ...status,
            healthy: false,
            error: 'Health check timeout'
          });
        }
      }
    }, this.autoCheckIntervalMs);
  }

  stopPeriodicHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Fallback manager functionality
  selectHealthyProvider(providers: string[]): string | null {
    const healthyProviders = providers.filter(provider => {
      const health = this.healthStatus.get(provider);
      return health?.healthy === true;
    });

    if (healthyProviders.length === 0) {
      return null;
    }

    // Select the provider with the lowest latency
    let bestProvider = healthyProviders[0];
    let bestLatency = this.healthStatus.get(bestProvider)?.latency || Infinity;

    for (const provider of healthyProviders) {
      const latency = this.healthStatus.get(provider)?.latency || Infinity;
      if (latency < bestLatency) {
        bestProvider = provider;
        bestLatency = latency;
      }
    }

    return bestProvider;
  }
}

export class FallbackManager {
  constructor(private healthMonitor: HealthMonitor) {}

  async routeWithFallback(
    originalRequest: any,
    context: any,
    targetModel: string,
    providersConfig: { [key: string]: ProviderConfig },
    maxRetries: number = 3
  ): Promise<any> {
    const availableProviders = this.getProvidersForModel(targetModel, providersConfig);
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const selectedProvider = this.healthMonitor.selectHealthyProvider(availableProviders);
      
      if (!selectedProvider) {
        throw new Error('No healthy providers available');
      }

      try {
        const response = await this.makeRequest(
          originalRequest,
          selectedProvider,
          targetModel,
          providersConfig[selectedProvider]
        );

        return {
          ...response,
          success: true,
          provider: selectedProvider,
          model: targetModel,
          routingReason: attempt > 0 ? 'fallback' : 'primary'
        };
      } catch (error) {
        console.warn(`Request failed for provider ${selectedProvider}, attempt ${attempt + 1}:`, error);
        
        // Mark provider as unhealthy
        this.healthMonitor.checkProviderHealth(selectedProvider, providersConfig[selectedProvider]);
        
        if (attempt === maxRetries - 1) {
          throw error;
        }
      }
    }

    throw new Error('All fallback attempts failed');
  }

  private getProvidersForModel(model: string, providersConfig: { [key: string]: ProviderConfig }): string[] {
    return Object.entries(providersConfig)
      .filter(([_, config]) => config.models.includes(model))
      .map(([provider, _]) => provider);
  }

  private async makeRequest(
    originalRequest: any,
    provider: string,
    model: string,
    config: ProviderConfig
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: originalRequest.messages || [],
          ...originalRequest
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        ...data,
        latency: Date.now() - startTime
      };
    } catch (error: any) {
      throw new Error(`Request to ${provider} failed: ${error.message}`);
    }
  }
}