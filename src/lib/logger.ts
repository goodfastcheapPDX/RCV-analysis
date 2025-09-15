import Adze, { setup } from "adze";
import { isDebug, isVerbose } from "@/lib/env";

setup({
  format: "standard",
  meta: {
    env: process.env.NODE_ENV,
  },
});

/**
 * Log levels used throughout the application
 */
export const LOG_LEVELS = {
  ERROR: "error",
  WARN: "warn",
  INFO: "info",
  DEBUG: "debug",
  TRACE: "trace",
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

/**
 * Simple logger that just uses basic Adze instances
 */
function createSimpleLogger(namespace: string): Adze {
  return new Adze().withEmoji.timestamp.namespace(namespace).seal();
}

/**
 * Specialized loggers for different parts of the application
 */
export const loggers = {
  app: createSimpleLogger("app"),
  api: createSimpleLogger("api"),
  compute: createSimpleLogger("compute"),
  contract: createSimpleLogger("contract"),
  manifest: createSimpleLogger("manifest"),
  data: createSimpleLogger("data"),
  ui: createSimpleLogger("ui"),
  script: createSimpleLogger("script"),
  build: createSimpleLogger("build"),
  test: createSimpleLogger("test"),
} as const;

/**
 * Create a namespaced logger for specific modules/components
 * @param namespace - The namespace/module name (e.g., 'api', 'compute', 'ui')
 * @returns Namespaced logger instance
 */
export function createNamespacedLogger(namespace: string): Adze {
  return createSimpleLogger(namespace);
}

/**
 * Default logger for general application use
 */
export const appLogger = loggers.app;

/**
 * Utility function to safely stringify objects for logging
 * Handles circular references and sensitive data
 */
export function safeStringify(
  obj: unknown,
  sensitiveKeys: string[] = [],
): string {
  const seen = new WeakSet();

  return JSON.stringify(
    obj,
    (key, value) => {
      // Hide sensitive keys
      if (sensitiveKeys.includes(key.toLowerCase())) {
        return "[REDACTED]";
      }

      // Handle circular references
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular]";
        }
        seen.add(value);
      }

      return value;
    },
    2,
  );
}

/**
 * Error logging helper that extracts useful information from Error objects
 */
export function logError(
  logger: Adze,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const errorInfo: Record<string, unknown> = {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : "Unknown",
    stack: error instanceof Error ? error.stack : undefined,
    ...context,
  };

  logger.error("Error occurred", errorInfo);
}

/**
 * Performance logging helper for timing operations
 */
export class Timer {
  private startTime: number;
  private logger: Adze;
  private operation: string;

  constructor(logger: Adze, operation: string) {
    this.logger = logger;
    this.operation = operation;
    this.startTime = performance.now();

    if (isVerbose() || isDebug()) {
      this.logger.debug(`Starting: ${operation}`);
    }
  }

  end(additionalData?: Record<string, unknown>): number {
    const duration = performance.now() - this.startTime;

    this.logger.info(`Completed: ${this.operation}`, {
      duration: `${duration.toFixed(2)}ms`,
      ...additionalData,
    });

    return duration;
  }
}

/**
 * Create a timer for performance logging
 */
export function createTimer(logger: Adze, operation: string): Timer {
  return new Timer(logger, operation);
}

export default appLogger;
