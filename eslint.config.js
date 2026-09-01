import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='innerHTML']",
          message: 'Never write user input into raw HTML.',
        },
      ],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    /**
     * The 3D layer is imperative by design: React Three Fiber hands back live
     * Three.js objects (camera, scene, meshes) and expects the frame loop to
     * mutate them in place. Re-creating them per frame is the bug this rule
     * would cause, not prevent.
     */
    files: ['src/components/scene/**/*.tsx', 'src/voxel/*.tsx'],
    rules: { 'react-hooks/immutability': 'off' },
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
);
