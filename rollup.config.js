import babel from 'rollup-plugin-babel';
import pkg from './package.json';

export default [
  {
    input: 'src/index.js',
    external: ['uuid/v4', 'aws-sdk'],
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' }
    ],
    plugins: [
      babel({
        exclude: ['node_modules/**']
      })
    ]
  }
];
