type ErrorTrackingConfig = {
	enabled?: boolean;
	useSentry?: boolean;
	logLocalErrors?: boolean;
	maxLocalErrors?: number;
	onError?: (errorInfo: ErrorInfo) => void;
};

type ErrorInfo = {
	message: string;
	stack: string;
	context: Record<string, unknown>;
	timestamp: string;
	url: string;
	userAgent: string;
	level: 'error' | 'warn' | 'info' | 'debug';
};

type SentryClient = {
	captureException?: (value: unknown, options?: unknown) => void;
	captureMessage?: (value: string, severity?: string) => void;
};

export class ErrorTrackingService {
	enabled: boolean;
	useSentry: boolean;
	logLocalErrors: boolean;
	errorLog: ErrorInfo[];
	maxLocalErrors: number;
	onError?: (errorInfo: ErrorInfo) => void;

	constructor(config: ErrorTrackingConfig = {}) {
		this.enabled = config.enabled !== false;
		this.useSentry = Boolean(
			config.useSentry &&
			typeof window !== 'undefined' &&
			(window as Window & { Sentry?: SentryClient }).Sentry
		);
		this.logLocalErrors = config.logLocalErrors !== false;
		this.errorLog = [];
		this.maxLocalErrors = config.maxLocalErrors || 1000;
		this.onError = config.onError;
	}

	captureException(error: unknown, context: Record<string, unknown> = {}) {
		if (!this.enabled) return;

		const errorObject = error instanceof Error ? error : new Error(String(error));
		const errorInfo: ErrorInfo = {
			message: errorObject.message || String(error),
			stack: errorObject.stack || '',
			context,
			timestamp: new Date().toISOString(),
			url: typeof window !== 'undefined' ? window.location.href : '',
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
			level: 'error',
		};

		if (this.useSentry) {
			(window as Window & { Sentry?: { captureException?: (value: unknown, options?: unknown) => void } }).Sentry?.captureException(errorObject, {
				contexts: { custom: context },
			});
		}

		if (this.logLocalErrors) {
			this.storeErrorLocally(errorInfo);
		}

		if (this.onError) {
			this.onError(errorInfo);
		}
	}

	captureMessage(message: string, level: 'error' | 'warn' | 'info' | 'debug' = 'info', context: Record<string, unknown> = {}) {
		if (!this.enabled) return;

		const eventInfo: ErrorInfo = {
			message,
			stack: '',
			context,
			timestamp: new Date().toISOString(),
			url: typeof window !== 'undefined' ? window.location.href : '',
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
			level,
		};

		if (this.useSentry) {
			(window as Window & { Sentry?: { captureMessage?: (value: string, severity?: string) => void } }).Sentry?.captureMessage(message, level);
		}

		if (this.logLocalErrors) {
			this.storeErrorLocally(eventInfo);
		}
	}

	storeErrorLocally(errorInfo: ErrorInfo) {
		try {
			this.errorLog.push(errorInfo);

			if (this.errorLog.length > this.maxLocalErrors) {
				this.errorLog = this.errorLog.slice(-this.maxLocalErrors);
			}

			const localKey = 'eduhub_errors';
			const stored = JSON.parse(localStorage.getItem(localKey) || '[]') as ErrorInfo[];
			stored.push(errorInfo);

			if (stored.length > 50) {
				stored.shift();
			}

			localStorage.setItem(localKey, JSON.stringify(stored));
		} catch {
			// Ignore local storage failures.
		}
	}
}

export class Logger {
	name: string;
	errorTracker?: ErrorTrackingService;
	minLevel: 'debug' | 'info' | 'warn' | 'error';
	logToConsole: boolean;
	logToServer: boolean;
	serverUrl?: string;

	constructor(name: string, config: { errorTracker?: ErrorTrackingService; minLevel?: 'debug' | 'info' | 'warn' | 'error'; logToConsole?: boolean; logToServer?: boolean; serverUrl?: string } = {}) {
		this.name = name;
		this.errorTracker = config.errorTracker;
		this.minLevel = config.minLevel || 'debug';
		this.logToConsole = config.logToConsole !== false;
		this.logToServer = config.logToServer || false;
		this.serverUrl = config.serverUrl;
	}

	log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data: Record<string, unknown> = {}) {
		const levels = { debug: 0, info: 1, warn: 2, error: 3 } as const;
		if (levels[level] < levels[this.minLevel]) return;

		if (this.logToConsole) {
			const prefix = `[${this.name}:${level.toUpperCase()}]`;
			console[level === 'debug' ? 'debug' : level](prefix, message, data);
		}

		if (level === 'error' && this.errorTracker) {
			this.errorTracker.captureException(new Error(message), data);
		}

		if (this.logToServer && this.serverUrl) {
			void fetch(this.serverUrl, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					timestamp: new Date().toISOString(),
					logger: this.name,
					level,
					message,
					data,
				}),
			}).catch(() => undefined);
		}
	}

	debug(message: string, data?: Record<string, unknown>) {
		this.log('debug', message, data);
	}

	info(message: string, data?: Record<string, unknown>) {
		this.log('info', message, data);
	}

	warn(message: string, data?: Record<string, unknown>) {
		this.log('warn', message, data);
	}

	error(message: string, data?: Record<string, unknown>) {
		this.log('error', message, data);
	}
}

export function setupGlobalErrorHandling(errorTracker: ErrorTrackingService) {
	if (typeof window === 'undefined') return;

	window.addEventListener('unhandledrejection', (event) => {
		errorTracker.captureException(event.reason || new Error('Unhandled Promise Rejection'), {
			type: 'unhandledRejection',
			promise: event.promise,
		});
	});

	window.addEventListener('error', (event) => {
		errorTracker.captureException(event.error || new Error(event.message), {
			type: 'uncaughtException',
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno,
		});
	});
}
