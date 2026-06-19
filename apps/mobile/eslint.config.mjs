// Expo's flat ESLint config. `expo lint` reads this.
// `eslint-config-expo` ships no `exports` map, so `/flat` resolves to a
// directory that Node's ESM loader can't import — point at the file directly.
import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat/default.js';

export default defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
]);
