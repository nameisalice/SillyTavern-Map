const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');

/**
 * Webpack configuration for SillyTavern Atlas.
 *
 * Output matches the SillyTavern third-party extension layout:
 *   dist/index.js  -> referenced by manifest.json "js"
 *   dist/style.css -> referenced by manifest.json "css"
 *
 * The host loads the bundle as a classic (non-module) script, so it is
 * built as a window library that attaches to the global jQuery ready
 * callback.
 *
 * HTML templates are copied to the repo root (sibling of dist/) because
 * `renderExtensionTemplateAsync('SillyTavern-Map', id)` fetches
 * `/scripts/extensions/SillyTavern-Map/<id>.html` — i.e. the extension
 * folder root, where manifest.json lives.
 */
module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      index: './src/index.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'index.js',
      clean: true,
      library: {
        type: 'window',
      },
      // Bundled assets (SVG/PNG) are emitted under dist/assets/ and
      // referenced from the bundle by relative URL.
      assetModuleFilename: 'assets/[name][ext]',
    },
    devtool: isProduction ? false : 'source-map',
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              // Use the build config which permits emit (base has noEmit).
              configFile: 'tsconfig.build.json',
              // Keep type-checking in the build for a single source of truth.
              transpileOnly: false,
            },
          },
        },
        {
          // Process all CSS, including vendored stylesheets (Leaflet).
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        {
          // Bundled binary/asset artwork referenced from the bundle.
          test: /\.(png|svg|jpg|jpeg|webp)$/i,
          exclude: /node_modules/,
          type: 'asset/resource',
        },
        {
          // HTML read directly as a source string (not host-rendered).
          test: /\.html$/,
          exclude: /node_modules/,
          type: 'asset/source',
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: 'style.css',
      }),
      // Ship host-rendered templates to the extension root so the host
      // can fetch them at `/scripts/extensions/SillyTavern-Map/<id>.html`.
      new CopyPlugin({
        patterns: [
          {
            // Ship host-rendered templates to the extension root (the
            // installed extension folder, sibling of dist/ and
            // manifest.json) so the host can fetch them at
            // `/scripts/extensions/<name>/<id>.html`. Copying the
            // directory (rather than a glob) flattens its contents to
            // the destination root.
            from: 'src/templates',
            to: path.resolve(__dirname),
          },
        ],
      }),
    ],
    performance: {
      // Asset-heavy extension; the heavy map images are not bundled here.
      hints: false,
    },
  };
};
