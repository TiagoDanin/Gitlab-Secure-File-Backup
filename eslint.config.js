// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'indent': ['error', 2],
      '@typescript-eslint/no-shadow': ['error'],
      'no-shadow': 'off',
      'no-undef': 'off',
      'no-var': 'error',
      'padding-line-between-statements': [
        'error',
        { blankLine: 'always',
          prev: 'export',
          next: '*' },
      ],
      'quotes': ['error', 'single'],
      'object-property-newline': ['error', { 'allowAllPropertiesOnSameLine': true }]
    }
  }
);
