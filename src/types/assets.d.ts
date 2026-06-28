/**
 * Ambient module declarations for non-TS assets imported from TypeScript.
 *
 * - `*.css`: imported for side effects (webpack extracts to dist/style.css
 *   via MiniCssExtractPlugin). The import has no runtime value.
 * - `*.svg`: imported as a URL string (webpack asset module). Used for
 *   bundled placeholder artwork.
 * - `*.html`: imported as a source string when read directly via the
 *   `asset/source` webpack rule. Host-rendered templates are not imported
 *   this way; they are fetched by `renderExtensionTemplateAsync`.
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
