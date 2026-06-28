/**
 * SillyTavern Atlas — extension entry point.
 *
 * The host loads this bundle as a classic script. We use the host's
 * jQuery ready callback (the official extension pattern) to start
 * Atlas once the DOM is ready, and import the bundled stylesheet so
 * webpack emits `dist/style.css`.
 */

import '@/styles/index.css';
import { bootstrap } from '@/app/bootstrap';
import { logError, logInfo } from '@/infra/logger';

// Host-provided ready callback. `jQuery` is declared in global.d.ts.
jQuery(async () => {
  try {
    const ok = await bootstrap();
    if (ok) {
      logInfo('Atlas loaded successfully.');
    }
  } catch (error) {
    // Last-resort boundary: never let an uncaught error escape into
    // the host.
    logError('Atlas failed to load.', error);
    if (typeof toastr !== 'undefined') {
      toastr.error('Atlas failed to load. See console for details.');
    }
  }
});
