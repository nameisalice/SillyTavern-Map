const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

/**
 * Webpack configuration for SillyTavern Atlas.
 *
 * Output matches the SillyTavern third-party extension layout:
 *   dist/index.js  -> referenced by manifest.json "js"
 *   dist/style.css -> referenced by manifest.json "css"
 *
 * The extension is loaded by SillyTavern as a classic (non-module) script,
 * so the bundle is built as a non-module library that attaches to the
 * global jQuery ready callback.
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
          test: /\.css$/,
          exclude: /node_modules/,
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        {
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
    ],
    performance: {
      // Asset-heavy extension; the heavy map images are not bundled here.
      hints: false,
    },
  };
};
