/**
 * ErrorTracking Service - Production-grade error tracking and logging
 * Supports Sentry integration or fallback to local error storage
 */

export class ErrorTrackingService {
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.useSentry = config.useSentry && window.Sentry;
    this.logLocalErrors = config.logLocalErrors !== false;
    this.errorLog = [];
    this.maxLocalErrors = config.maxLocalErrors || 1000;
    this.onError = config.onError; // Custom callback
  }

  /**
   * Capture and report an exception
   */
  captureException(error, context = {}) {
    if (!this.enabled) return;

    const errorInfo = {
      message: error?.message || String(error),
      stack: error?.stack || '',
      context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      level: 'error',
    };

    // Report to Sentry if available
    if (this.useSentry) {
      window.Sentry.captureException(error, { contexts: { custom: context } });
    }

    // Store locally
    if (this.logLocalErrors) {
      this.storeErrorLocally(errorInfo);
    }

    // Call custom callback
    if (this.onError) {
      this.onError(errorInfo);
    }

    console.error('[ErrorTracking]', errorInfo);
  }

  /**
   * Capture a message (non-error event)
   */
  captureMessage(message, level = 'info', context = {}) {
    if (!this.enabled) return;

    const eventInfo = {
      message,
      level,
      context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    if (this.useSentry) {
      window.Sentry.captureMessage(message, level);
    }

    if (this.logLocalErrors) {
      this.storeErrorLocally(eventInfo);
    }

    console.log(`[ErrorTracking:${level}]`, eventInfo);
  }

  /**
   * Store error locally in IndexedDB or localStorage
   */
  storeErrorLocally(errorInfo) {
    try {
      this.errorLog.push(errorInfo);

      // Trim if exceeded max
      if (this.errorLog.length > this.maxLocalErrors) {
        this.errorLog = this.errorLog.slice(-this.maxLocalErrors);
      }

      // Also persist to localStorage for recovery after refresh
      const localKey = 'eduhub_errors';
      const stored = JSON.parse(localStorage.getItem(localKey) || '[]');
      stored.push(errorInfo);

      if (stored.length > 50) {
        stored.shift(); // Keep only last 50 for localStorage
      }

      localStorage.setItem(localKey, JSON.stringify(stored));
    } catch (err) {
      // Silently fail - don't throw during error tracking
      console.warn('Failed to store error locally:', err);
    }
  }

  /**
   * Get error log for diagnostics
   */
  getErrorLog(limit = 100) {
    return this.errorLog.slice(-limit);
  }

  /**
   * Get errors grouped by type
   */
  getErrorStats() {
    const stats = {
      total: this.errorLog.length,
      byLevel: {},
      byType: {},
      recentErrors: [],
    };

    for (const error of this.errorLog) {
      stats.byLevel[error.level] = (stats.byLevel[error.level] || 0) + 1;

      const errorType = error.message?.split(':')[0] || 'Unknown';
      stats.byType[errorType] = (stats.byType[errorType] || 0) + 1;
    }

    stats.recentErrors = this.errorLog.slice(-5);

    return stats;
  }

  /**
   * Clear error log
   */
  clearErrorLog() {
    this.errorLog = [];
    try {
      localStorage.removeItem('eduhub_errors');
    } catch (err) {
      console.warn('Failed to clear stored errors:', err);
    }
  }

  /**
   * Set user context for error tracking
   */
  setUserContext(userId, email = null) {
    if (this.useSentry) {
      window.Sentry.setUser({ id: userId, email });
    }
  }

  /**
   * Add breadcrumb (event trail for debugging)
   */
  addBreadcrumb(message, category = 'info', level = 'info') {
    if (this.useSentry) {
      window.Sentry.addBreadcrumb({ message, category, level });
    }
  }
}

/**
 * Logger - Structured logging with multiple levels
 */
export class Logger {
  constructor(name, config = {}) {
    this.name = name;
    this.errorTracker = config.errorTracker;
    this.minLevel = config.minLevel || 'debug'; // debug, info, warn, error
    this.logToConsole = config.logToConsole !== false;
    this.logToServer = config.logToServer || false;
    this.serverUrl = config.serverUrl;
  }

  log(level, message, data = {}) {
    // Check log level
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    if (levels[level] < levels[this.minLevel]) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      logger: this.name,
      level,
      message,
      data,
    };

    // Console output
    if (this.logToConsole) {
      const prefix = `[${this.name}:${level.toUpperCase()}]`;
      console[level === 'debug' ? 'debug' : level](prefix, message, data);
    }

    // Error tracking
    if (level === 'error' && this.errorTracker) {
      this.errorTracker.captureException(new Error(message), data);
    }

    // Server logging
    if (this.logToServer && this.serverUrl) {
      this.sendToServer(logEntry);
    }
  }

  debug(message, data) {
    this.log('debug', message, data);
  }

  info(message, data) {
    this.log('info', message, data);
  }

  warn(message, data) {
    this.log('warn', message, data);
  }

  error(message, data) {
    this.log('error', message, data);
  }

  async sendToServer(logEntry) {
    try {
      await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry),
      });
    } catch (err) {
      console.error('Failed to send log to server:', err);
    }
  }
}

/**
 * Global error handler wrapper - catches unhandled errors at app level
 */
export function setupGlobalErrorHandling(errorTracker) {
  // Catch unhandled rejections
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', event => {
      errorTracker.captureException(
        event.reason || new Error('Unhandled Promise Rejection'),
        { type: 'unhandledRejection', promise: event.promise }
      );
    });

    // Catch uncaught errors
    window.addEventListener('error', event => {
      errorTracker.captureException(event.error || new Error(event.message), {
        type: 'uncaughtException',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });
  }
}

export default { ErrorTrackingService, Logger, setupGlobalErrorHandling };
