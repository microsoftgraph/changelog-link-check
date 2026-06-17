// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

// cSpell:ignore onwarn

import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const config = {
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    inlineDynamicImports: true,
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    typescript({ sourceMap: true }),
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
  ],
  // @ts-expect-error Rollup's parser doesn't expect types
  onwarn(warning, warn) {
    // Suppress known-benign warnings from @actions/core CJS modules
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
};

export default config;
