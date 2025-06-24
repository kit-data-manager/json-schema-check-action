// See: https://rollupjs.org/introduction/

import json from '@rollup/plugin-json'
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

const config = {
  input: ['src/index.ts', 'src/main.ts'],
  output: {
    esModule: true,
    dir: 'dist/',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json'
    }),
    nodeResolve({
      preferBuiltins: true,
      extensions: ['.js', '.ts']
    }),
    commonjs(),
    json()
  ]
}

export default config
