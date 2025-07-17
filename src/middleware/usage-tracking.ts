import { SynapseContext } from './synapse-context';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface UsageRecord {
  id: string;
  timestamp: Date;
  projectId?: string;
  agentId?: string;
  agentType?: string;
  model: string;
  provider: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  cost: number;
  latency: number;
  success: boolean;
  routingReason: string;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
  successRate: number;
  modelBreakdown: { [key: string]: number };
  agentBreakdown: { [key: string]: number };
}

export interface UsageFilters {
  projectId?: string;
  agentId?: string;
  timeRange?: { start: Date; end: Date };
}

export class UsageStorage {
  private storagePath: string;

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    this.storagePath = path.join(homeDir, '.claude-code-router', 'usage.json');
    this.ensureStorageDirectory();
  }

  private ensureStorageDirectory(): void {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async save(record: UsageRecord): Promise<void> {
    try {
      let records: UsageRecord[] = [];
      
      if (fs.existsSync(this.storagePath)) {
        const data = fs.readFileSync(this.storagePath, 'utf8');
        if (data.trim()) {
          records = JSON.parse(data);
        }
      }

      records.push(record);
      
      // Keep only last 10,000 records to prevent file from growing too large
      if (records.length > 10000) {
        records = records.slice(-10000);
      }

      fs.writeFileSync(this.storagePath, JSON.stringify(records, null, 2));
    } catch (error) {
      console.error('Failed to save usage record:', error);
    }
  }

  async query(filters: UsageFilters): Promise<UsageRecord[]> {
    try {
      if (!fs.existsSync(this.storagePath)) {
        return [];
      }

      const data = fs.readFileSync(this.storagePath, 'utf8');
      if (!data.trim()) {
        return [];
      }

      let records: UsageRecord[] = JSON.parse(data);

      // Apply filters
      if (filters.projectId) {
        records = records.filter(r => r.projectId === filters.projectId);
      }

      if (filters.agentId) {
        records = records.filter(r => r.agentId === filters.agentId);
      }

      if (filters.timeRange) {
        records = records.filter(r => {
          const timestamp = new Date(r.timestamp);
          return timestamp >= filters.timeRange!.start && timestamp <= filters.timeRange!.end;
        });
      }

      return records;
    } catch (error) {
      console.error('Failed to query usage records:', error);
      return [];
    }
  }
}

export class UsageTracker {
  private storage: UsageStorage;

  constructor() {
    this.storage = new UsageStorage();
  }

  async trackRequest(context: SynapseContext, response: any): Promise<UsageRecord> {
    const record: UsageRecord = {
      id: this.generateId(),
      timestamp: new Date(),
      projectId: context.projectId,
      agentId: context.agentId,
      agentType: context.agentType,
      model: response.model,
      provider: response.provider,
      tokens: {
        input: response.usage?.prompt_tokens || 0,
        output: response.usage?.completion_tokens || 0,
        total: response.usage?.total_tokens || 0
      },
      cost: this.calculateCost(response),
      latency: response.latency || 0,
      success: response.success,
      routingReason: response.routingReason || 'default'
    };

    await this.storage.save(record);
    return record;
  }

  async getUsageStats(filters: UsageFilters): Promise<UsageStats> {
    const records = await this.storage.query(filters);

    if (records.length === 0) {
      return {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageLatency: 0,
        successRate: 0,
        modelBreakdown: {},
        agentBreakdown: {}
      };
    }

    return {
      totalRequests: records.length,
      totalTokens: records.reduce((sum, r) => sum + r.tokens.total, 0),
      totalCost: records.reduce((sum, r) => sum + r.cost, 0),
      averageLatency: records.reduce((sum, r) => sum + r.latency, 0) / records.length,
      successRate: records.filter(r => r.success).length / records.length,
      modelBreakdown: this.groupBy(records, 'model'),
      agentBreakdown: this.groupBy(records, 'agentType')
    };
  }

  private generateId(): string {
    return randomUUID();
  }

  private calculateCost(response: any): number {
    // Basic cost calculation - this would need to be enhanced with actual pricing
    const usage = response.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    
    // Rough estimates (would need actual pricing data)
    const inputCostPer1k = 0.01; // $0.01 per 1k input tokens
    const outputCostPer1k = 0.03; // $0.03 per 1k output tokens
    
    return (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
  }

  private groupBy(records: UsageRecord[], field: keyof UsageRecord): { [key: string]: number } {
    return records.reduce((acc, record) => {
      const key = String(record[field] || 'unknown');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
  }
}