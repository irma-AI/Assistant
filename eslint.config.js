//  @ts-check

import comments from '@eslint-community/eslint-plugin-eslint-comments/configs'
import { tanstackConfig } from '@tanstack/eslint-config'
import router from '@tanstack/eslint-plugin-router'
import tseslint from 'typescript-eslint'

export default [
  ...tanstackConfig,
  ...tseslint.configs.strictTypeChecked,
  comments.recommended,
  ...router.configs['flat/recommended'],
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
      'pnpm/json-enforce-catalog': 'off',
      // Types are inferred, never cast.
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      'max-lines': [
        'error',
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      'max-lines-per-function': [
        'error',
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
      complexity: ['error', 10],
      // Every suppression says why.
      '@eslint-community/eslint-comments/require-description': 'error',
    },
  },
  {
    ignores: [
      'eslint.config.js',
      '.dependency-cruiser.cjs',
      'prettier.config.js',
      'src/routeTree.gen.ts',
      'src/server/db.gen.ts',
      '.output/**',
    ],
  },
]
