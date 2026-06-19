// Flat config root. Per-package configs may extend this.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/.turbo/**', '**/generated/**', '**/node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
