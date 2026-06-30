/**
 * Exact structured Atlas tag parser.
 *
 * This parser intentionally does not infer locations from prose. It
 * accepts only explicit self-closing tags with quoted ids.
 */

export type AtlasStructuredCommand =
  | { readonly type: 'travel'; readonly locationId: string }
  | { readonly type: 'reveal'; readonly locationId: string }
  | { readonly type: 'hide'; readonly locationId: string };

const TAG_PATTERN = /<atlas-(travel|reveal|hide)\s+location="([a-z0-9][a-z0-9_-]*)"\s*\/>/g;

export function parseAtlasStructuredCommands(text: string): readonly AtlasStructuredCommand[] {
  const commands: AtlasStructuredCommand[] = [];
  for (const match of text.matchAll(TAG_PATTERN)) {
    const action = match[1];
    const locationId = match[2];
    if (action === 'travel') {
      commands.push({ type: 'travel', locationId });
    } else if (action === 'reveal') {
      commands.push({ type: 'reveal', locationId });
    } else if (action === 'hide') {
      commands.push({ type: 'hide', locationId });
    }
  }
  return commands;
}

export function stripAtlasStructuredCommands(text: string): string {
  return text.replace(TAG_PATTERN, '').trim();
}
