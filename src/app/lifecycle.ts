/**
 * Legacy panel-lifecycle path. The canonical implementation now lives
 * in `@/core/lifecycle`. This file re-exports it so existing imports
 * keep working during the layering migration. Prefer `@/core/lifecycle`
 * in new code.
 */

export {
  bindPanel,
  closePanel,
  isPanelOpen,
  openPanel,
  togglePanel,
  type PanelState,
} from '@/core/lifecycle';
