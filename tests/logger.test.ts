/**
 * Tests for the leveled logger.
 *
 * These verify level gating without asserting on console output shape,
 * only that the configured console method is (not) called.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Re-import after stubbing console methods. The logger module holds the
// active level in module scope, so each test resets it explicitly.
import { getLogLevel, logDebug, logError, logInfo, logWarn, setLogLevel } from '@/infra/logger';

describe('logger level gating', () => {
  let consoleError: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let consoleInfo: ReturnType<typeof vi.spyOn>;
  let consoleDebug: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    consoleDebug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to the info level', () => {
    setLogLevel('info');
    expect(getLogLevel()).toBe('info');
  });

  it('emits error, warn, and info at the info level but not debug', () => {
    setLogLevel('info');
    logError('e');
    logWarn('w');
    logInfo('i');
    logDebug('d');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleInfo).toHaveBeenCalledTimes(1);
    expect(consoleDebug).not.toHaveBeenCalled();
  });

  it('emits only errors at the error level', () => {
    setLogLevel('error');
    logError('e');
    logWarn('w');
    logInfo('i');
    logDebug('d');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleInfo).not.toHaveBeenCalled();
    expect(consoleDebug).not.toHaveBeenCalled();
  });

  it('emits everything at the debug level', () => {
    setLogLevel('debug');
    logError('e');
    logWarn('w');
    logInfo('i');
    logDebug('d');
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    expect(consoleInfo).toHaveBeenCalledTimes(1);
    expect(consoleDebug).toHaveBeenCalledTimes(1);
  });

  it('prefixes every line with the stable Atlas prefix', () => {
    setLogLevel('info');
    logInfo('hello');
    expect(consoleInfo).toHaveBeenCalledWith(expect.stringContaining('[SillyTavern Atlas] hello'));
  });

  it('forwards extra arguments after the prefixed message', () => {
    setLogLevel('info');
    const detail = { code: 42 };
    logInfo('event', detail);
    expect(consoleInfo).toHaveBeenCalledWith(
      expect.stringContaining('[SillyTavern Atlas] event'),
      detail,
    );
  });
});
