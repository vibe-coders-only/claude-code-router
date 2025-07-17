import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  context?: {
    requestId?: string;
    projectId?: string;
    agentId?: string;
    agentType?: string;
  };
}

export class SynapseLogger {
  private static instance: SynapseLogger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logFile: string;
  private logToConsole: boolean = true;
  private logToFile: boolean = true;

  private constructor() {
    const homeDir = homedir();
    this.logFile = path.join(homeDir, '.claude-code-router', 'synapse.log');
    this.ensureLogDirectory();
  }

  static getInstance(): SynapseLogger {
    if (!SynapseLogger.instance) {
      SynapseLogger.instance = new SynapseLogger();
    }
    return SynapseLogger.instance;
  }

  private ensureLogDirectory(): void {
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setLogToConsole(enabled: boolean): void {
    this.logToConsole = enabled;
  }

  setLogToFile(enabled: boolean): void {
    this.logToFile = enabled;
  }

  private writeLog(entry: LogEntry): void {
    const logLine = JSON.stringify(entry) + '\n';

    if (this.logToConsole) {
      const color = this.getLogColor(entry.level);
      console.log(`${color}[${entry.timestamp}] ${entry.level}: ${entry.message}\x1b[0m`);
      if (entry.data) {
        console.log(JSON.stringify(entry.data, null, 2));
      }
    }

    if (this.logToFile) {
      try {
        fs.appendFileSync(this.logFile, logLine);
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  private getLogColor(level: string): string {
    switch (level.toLowerCase()) {
      case 'debug': return '\x1b[36m'; // Cyan
      case 'info': return '\x1b[32m';  // Green
      case 'warn': return '\x1b[33m';  // Yellow
      case 'error': return '\x1b[31m'; // Red
      default: return '\x1b[0m';       // Reset
    }
  }

  private log(level: LogLevel, message: string, data?: any, context?: any): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      data,
      context
    };

    this.writeLog(entry);
  }

  debug(message: string, data?: any, context?: any): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  info(message: string, data?: any, context?: any): void {
    this.log(LogLevel.INFO, message, data, context);
  }

  warn(message: string, data?: any, context?: any): void {
    this.log(LogLevel.WARN, message, data, context);
  }

  error(message: string, data?: any, context?: any): void {
    this.log(LogLevel.ERROR, message, data, context);
  }

  // Context-aware logging methods
  logRequest(context: any, message: string, data?: any): void {
    this.info(message, data, {
      requestId: context.requestId,
      projectId: context.projectId,
      agentId: context.agentId,
      agentType: context.agentType
    });
  }

  logError(context: any, error: Error, message?: string): void {
    this.error(message || 'Error occurred', {
      error: error.message,
      stack: error.stack,
      name: error.name
    }, {
      requestId: context.requestId,
      projectId: context.projectId,
      agentId: context.agentId,
      agentType: context.agentType
    });
  }

  logPerformance(context: any, operation: string, duration: number, data?: any): void {
    this.info(`Performance: ${operation} completed in ${duration}ms`, data, {
      requestId: context.requestId,
      projectId: context.projectId,
      agentId: context.agentId,
      agentType: context.agentType
    });
  }

  // Rotate log files to prevent them from growing too large
  rotateLogFile(): void {
    try {
      const stats = fs.statSync(this.logFile);
      const fileSizeInMB = stats.size / (1024 * 1024);

      if (fileSizeInMB > 10) { // Rotate if file is larger than 10MB
        const rotatedFile = this.logFile + '.1';
        
        // Remove old rotated file if it exists
        if (fs.existsSync(rotatedFile)) {
          fs.unlinkSync(rotatedFile);
        }
        
        // Move current log to rotated file
        fs.renameSync(this.logFile, rotatedFile);
        
        this.info('Log file rotated');
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  // Clean up old log files
  cleanupOldLogs(retentionDays: number = 30): void {
    try {
      const logDir = path.dirname(this.logFile);
      const files = fs.readdirSync(logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      files.forEach(file => {
        if (file.startsWith('synapse.log')) {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            this.info(`Cleaned up old log file: ${file}`);
          }
        }
      });
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }
}

// Export a singleton instance
export const synapseLogger = SynapseLogger.getInstance();