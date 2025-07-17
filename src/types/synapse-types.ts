// Re-export all types from middleware and API modules
export * from '../middleware/synapse-context';
export * from '../middleware/usage-tracking';
export * from '../middleware/health-monitoring';
export * from '../api/synapse-endpoints';

// Additional types for enhanced functionality
export interface AgentMapping {
  primaryModel: string;
  fallbackModels: string[];
  contextWindow: number;
  temperature: number;
}

export interface CostLimits {
  global: {
    daily: number;
    monthly: number;
  };
  perProject: {
    daily: number;
    monthly: number;
  };
  perAgent: {
    daily: number;
    monthly: number;
  };
}

export interface LoadBalancingConfig {
  enabled: boolean;
  strategy: 'round_robin' | 'least_latency' | 'weighted' | 'random';
  weights?: { [provider: string]: number };
}

export interface CostOptimizationConfig {
  enabled: boolean;
  preferCheaperModels: boolean;
  maxCostPerRequest?: number;
}

export interface AlertingConfig {
  enabled: boolean;
  thresholds: {
    errorRate: number;
    avgLatency: number;
  };
  webhookUrl?: string;
  emailNotifications?: string[];
}

export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
    burstLimit: number;
  };
  apiKeyRotation: {
    enabled: boolean;
    intervalHours: number;
  };
  allowedOrigins?: string[];
  requireAuth?: boolean;
}

export interface CachingConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  redisUrl?: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  destination: 'console' | 'file' | 'both';
  retention: {
    days: number;
  };
  format?: 'json' | 'text';
}

export interface PerformanceMetrics {
  requestsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  throughput: number;
  queueSize: number;
  activeConnections: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
}

export interface RequestContext {
  requestId: string;
  timestamp: Date;
  userAgent?: string;
  clientIp?: string;
  sessionId?: string;
  traceId?: string;
}

export interface ModelCapabilities {
  maxTokens: number;
  supportsVision: boolean;
  supportsCodeExecution: boolean;
  supportsTools: boolean;
  costPer1kTokens: {
    input: number;
    output: number;
  };
}

export interface ProviderStatus {
  provider: string;
  status: 'online' | 'offline' | 'degraded';
  lastCheck: Date;
  latency: number;
  errorCount: number;
  successRate: number;
  models: ModelCapabilities[];
}

export interface RoutingDecision {
  selectedModel: string;
  selectedProvider: string;
  reason: string;
  confidence: number;
  alternatives: Array<{
    model: string;
    provider: string;
    score: number;
  }>;
}

export interface UsageBreakdown {
  byModel: { [model: string]: UsageStats };
  byProvider: { [provider: string]: UsageStats };
  byAgentType: { [agentType: string]: UsageStats };
  byProject: { [projectId: string]: UsageStats };
  byTimeOfDay: { [hour: string]: UsageStats };
}

export interface ModelPerformance {
  model: string;
  provider: string;
  metrics: {
    avgLatency: number;
    successRate: number;
    errorRate: number;
    throughput: number;
    cost: number;
  };
  sampleSize: number;
  lastUpdated: Date;
}

export interface EnhancedRouterConfig extends RouterConfig {
  agentMapping: { [agentType: string]: AgentMapping };
  costLimits: CostLimits;
  routing: RouterConfig['routing'] & {
    loadBalancing: LoadBalancingConfig;
    costOptimization: CostOptimizationConfig;
  };
  monitoring: RouterConfig['monitoring'] & {
    performanceMetrics: boolean;
    alerting: AlertingConfig;
  };
  security: SecurityConfig;
  caching: CachingConfig;
  logging: LoggingConfig;
}

export interface SynapseMiddlewareOptions {
  enableContextExtraction: boolean;
  enableHealthChecks: boolean;
  enableUsageTracking: boolean;
  enableCaching: boolean;
  enableRateLimiting: boolean;
}

export interface RoutingMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  routingDecisions: RoutingDecision[];
  providerUtilization: { [provider: string]: number };
  modelUtilization: { [model: string]: number };
}

export interface ConfigValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  retention: {
    days: number;
    maxBackups: number;
  };
  storage: {
    type: 'local' | 's3' | 'gcs';
    path: string;
    credentials?: any;
  };
}

// Event types for the event system
export interface SynapseEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: any;
  source: string;
}

export interface RequestEvent extends SynapseEvent {
  type: 'request';
  data: {
    context: SynapseContext;
    model: string;
    provider: string;
    latency: number;
    success: boolean;
  };
}

export interface HealthCheckEvent extends SynapseEvent {
  type: 'health_check';
  data: {
    provider: string;
    healthy: boolean;
    latency: number;
  };
}

export interface ConfigChangeEvent extends SynapseEvent {
  type: 'config_change';
  data: {
    field: string;
    oldValue: any;
    newValue: any;
    user?: string;
  };
}

export interface AlertEvent extends SynapseEvent {
  type: 'alert';
  data: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    metric: string;
    value: number;
    threshold: number;
  };
}

// Plugin system types
export interface SynapsePlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  initialize: (context: PluginContext) => Promise<void>;
  cleanup?: () => Promise<void>;
  hooks?: {
    beforeRequest?: (context: SynapseContext) => Promise<SynapseContext>;
    afterRequest?: (context: SynapseContext, response: any) => Promise<void>;
    onError?: (error: Error, context: SynapseContext) => Promise<void>;
  };
}

export interface PluginContext {
  config: EnhancedRouterConfig;
  logger: any;
  metrics: PerformanceMetrics;
  events: {
    emit: (event: SynapseEvent) => void;
    on: (type: string, handler: (event: SynapseEvent) => void) => void;
  };
}