import { builtinModules } from 'module';

import { string } from 'rollup-plugin-string';

import pkg from './package.json';

const externals = new Set([
  ...builtinModules,
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
]);

export default {
  input: './src/index.js',
  external: (id) => externals.has(id),
  plugins: [string({ include: '**/*.include.js' })],
  output: {
    file: './dist/index.js',
    format: 'cjs',
  },
};
