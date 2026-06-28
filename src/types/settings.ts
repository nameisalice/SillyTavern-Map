/**
 * Legacy settings types path. The canonical definitions now live in
 * `@/types/common/settings`. This file re-exports them so existing
 * imports keep working during the layering migration. Prefer
 * `@/types/common` in new code.
 */

export type { AtlasSettings } from '@/types/common/settings';
export { DEFAULT_SETTINGS } from '@/types/common/settings';
