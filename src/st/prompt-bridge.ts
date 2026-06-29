/**
 * PromptBridge: safe wrapper that passes the compiled prompt block
 * to SillyTavern using `setExtensionPrompt`.
 *
 * It is pure host-I/O infrastructure. Position, depth, and role values
 * are resolved by the service layer from settings before calling this
 * bridge, keeping it free of dependency on settings types.
 */

import { getContext, tryGetContext } from '@/st/context';

export const SPATIAL_PROMPT_KEY = 'sillytavern_atlas_spatial_context';

/**
 * Injects the compiled prompt text into SillyTavern's prompt queue.
 */
export function injectSpatialPrompt(args: {
  readonly text: string;
  readonly position: number;
  readonly depth: number;
  readonly scanWI: boolean;
  readonly role: number;
}): void {
  try {
    const context = getContext();
    context.setExtensionPrompt(
      SPATIAL_PROMPT_KEY,
      args.text,
      args.position,
      args.depth,
      args.scanWI,
      args.role,
    );
  } catch {
    // Degrade gracefully if context is not loaded or during tests.
  }
}

/**
 * Clears the injected extension prompt by passing an empty string and
 * position NONE (-1) to the host.
 */
export function clearSpatialPrompt(): void {
  try {
    const context = tryGetContext();
    if (context) {
      context.setExtensionPrompt(
        SPATIAL_PROMPT_KEY,
        '',
        -1, // NONE position
        0,
        false,
        0, // SYSTEM role
      );
    }
  } catch {
    // Degrade gracefully.
  }
}
