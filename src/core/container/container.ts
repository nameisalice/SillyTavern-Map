/**
 * A minimal dependency container for SillyTavern Atlas.
 *
 * No third-party IoC framework. Services register themselves under a
 * string key (a `DependencyToken`) and other modules resolve them by
 * that key. This keeps services from instantiating each other directly
 * — the rule "future services should never instantiate each other
 * directly" is enforced by convention: every cross-service dependency
 * goes through `container.resolve(Token)`.
 *
 * Two registration modes:
 * - `singleton`: the factory is called once; the same instance is
 *   returned on every resolve.
 * - `instance`: the factory is called on every resolve.
 *
 * The container is the composition root's responsibility. Bootstrap
 * registers the core singletons (logger, event bus, settings bridge)
 * and nothing else owns construction order.
 */

import { DependencyNotFoundError } from '@/core/errors';

/**
 * A string-branded token identifying a registered dependency. Using a
 * branded type (rather than a bare string) prevents accidental key
 * collisions with arbitrary strings.
 */
export type DependencyToken<T = unknown> = string & { readonly __dep: T };

/** Factory that produces the dependency instance. */
export type DependencyFactory<T> = () => T;

/** Registration modes. */
export type RegistrationKind = 'singleton' | 'instance';

interface Registration<T> {
  readonly kind: RegistrationKind;
  readonly factory: DependencyFactory<T>;
  /** Cached singleton instance, lazily populated. */
  cached: T | undefined;
}

/**
 * The Atlas dependency container. One instance is created at bootstrap
 * and shared for the extension lifetime.
 */
export class Container {
  private readonly registrations = new Map<DependencyToken, Registration<unknown>>();

  /**
   * Registers a dependency under a token. Throws if a different factory
   * is already registered for the same token — re-registration with the
   * same factory is a no-op (useful for hot paths), but a conflicting
   * registration is a programmer error.
   */
  register<T>(
    token: DependencyToken<T>,
    factory: DependencyFactory<T>,
    kind: RegistrationKind = 'singleton',
  ): void {
    const existing = this.registrations.get(token);
    if (existing && existing.factory !== factory) {
      throw new Error(
        `Dependency token "${token}" is already registered with a different factory.`,
      );
    }
    if (existing) {
      return;
    }
    this.registrations.set(token, {
      kind,
      factory: factory as DependencyFactory<unknown>,
      cached: undefined,
    });
  }

  /**
   * Resolves a dependency by token. For singletons the factory runs
   * once and the result is cached. Throws `DependencyNotFoundError` if
   * nothing is registered for the token.
   */
  resolve<T>(token: DependencyToken<T>): T {
    const reg = this.registrations.get(token) as Registration<T> | undefined;
    if (!reg) {
      throw new DependencyNotFoundError(token);
    }
    if (reg.kind === 'singleton') {
      if (reg.cached === undefined) {
        reg.cached = reg.factory();
      }
      return reg.cached;
    }
    return reg.factory();
  }

  /** Returns true if a dependency is registered for the token. */
  has<T>(token: DependencyToken<T>): boolean {
    return this.registrations.has(token);
  }

  /**
   * Clears all registrations and cached instances. Mainly for tests;
   * production code never resets the container.
   */
  clear(): void {
    this.registrations.clear();
  }
}

/**
 * Helper to declare a typed token. Returns a brand-new token each call,
 * so each module that needs a dependency declares its own constant:
 *
 * ```ts
 * export const LoggerService = token<Logger>('LoggerService');
 * ```
 */
export function token<T>(name: string): DependencyToken<T> {
  return name as DependencyToken<T>;
}
