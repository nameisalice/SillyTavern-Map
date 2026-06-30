/**
 * Ambient module declarations for non-TS assets imported from TypeScript.
 *
 * - `*.css`: imported for side effects (webpack extracts to dist/style.css
 *   via MiniCssExtractPlugin). The import has no runtime value.
 * - `*.svg`: imported as a URL string (webpack asset module). Used for
 *   bundled placeholder artwork.
 * - `*.html`: imported as a source string via the `asset/source`
 *   webpack rule. Atlas bundles runtime templates so third-party
 *   installs do not depend on host template fetch paths.
 */

declare module '*.css' {
  const content: void;
  export default content;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.html' {
  const content: string;
  export default content;
}

declare module '*.html?raw' {
  const content: string;
  export default content;
}
