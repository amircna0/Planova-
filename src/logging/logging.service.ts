import { Injectable, LoggerService } from '@nestjs/common';
import { existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  trace?: string;
  meta?: Record<string, unknown>;
}

@Injectable()
export class LoggingService implements LoggerService {
  private readonly logsDir = join(process.cwd(), 'logs');

  constructor() {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }
  }

  log(message: string, context?: string, meta?: Record<string, unknown>) {
    this.write({ level: 'log', message, context, meta });
  }

  error(message: string, trace?: string, context?: string, meta?: Record<string, unknown>) {
    this.write({ level: 'error', message, trace, context, meta });
  }

  warn(message: string, context?: string, meta?: Record<string, unknown>) {
    this.write({ level: 'warn', message, context, meta });
  }

  debug(message: string, context?: string, meta?: Record<string, unknown>) {
    this.write({ level: 'debug', message, context, meta });
  }

  verbose(message: string, context?: string, meta?: Record<string, unknown>) {
    this.write({ level: 'verbose', message, context, meta });
  }

  client(message: string, meta?: Record<string, unknown>) {
    this.write({ level: 'warn', message, context: 'ClientLog', meta });
  }

  private write(entry: LogEntry) {
    const payload = {
      timestamp: new Date().toISOString(),
      pid: process.pid,
      ...entry,
    };
    const line = `${JSON.stringify(payload)}\n`;

    appendFileSync(join(this.logsDir, 'app.log'), line);

    if (entry.level === 'error') {
      appendFileSync(join(this.logsDir, 'error.log'), line);
    }

    const consoleMethod = entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[${payload.timestamp}] [${entry.level.toUpperCase()}] ${entry.context || 'App'}: ${entry.message}`);
  }
}
