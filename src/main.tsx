import React from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.tsx'
import './index.css'

// Initialize error tracking
import { ErrorTrackingService, setupGlobalErrorHandling } from '@/infrastructure/services/ErrorTrackingService'
import { runtimeEnvStatus } from '@/lib/runtimeEnv'

const errorTracker = new ErrorTrackingService({
	enabled: true,
	useSentry: runtimeEnvStatus.isSentryConfigured,
	logLocalErrors: true,
	onError: (errorInfo) => {
		// Send to server if configured
		if (runtimeEnvStatus.isLoggingConfigured) {
			try {
				navigator.sendBeacon('/api/logs', JSON.stringify(errorInfo));
			} catch {
				// sendBeacon is fire-and-forget; ignore transport failures.
			}
		}
	},
});

setupGlobalErrorHandling(errorTracker);

// Expose error tracker globally for debugging
(window as Window & { __EDUHUB_ERROR_TRACKER__?: ErrorTrackingService }).__EDUHUB_ERROR_TRACKER__ = errorTracker;

const updateSW = registerSW({
	immediate: true,
	onNeedRefresh() {
		window.dispatchEvent(new CustomEvent('eduhub:pwa-update-ready'));
	},
	onOfflineReady() {
		window.dispatchEvent(new CustomEvent('eduhub:pwa-offline-ready'));
	},
});

(window as Window & { __EDUHUB_UPDATE_SW__?: (reloadPage?: boolean) => Promise<void> }).__EDUHUB_UPDATE_SW__ = updateSW;

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found.');
}

createRoot(rootElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
