// Metro config for the De Vrije Hond Expo app inside the pnpm monorepo.
//
// Two jobs:
//   1. Make Metro aware of the workspace root so linked workspace packages
//      (`@devrijehond/api-client`) resolve, and let `.js` imports in those
//      packages resolve to their TS source.
//   2. Pin every React-context / native-singleton library to the mobile
//      workspace's OWN copy. pnpm keeps multiple peer-variant copies of these
//      side by side; if a transitive import reaches one copy and the app
//      reaches another, any Context or module-level singleton they define
//      (QueryClient, SafeArea, the RN renderer, expo-router's store, a native
//      view registration) splits into two disconnected instances. Symptoms:
//      "No QueryClient set", "Cannot read property 'useState' of null", a
//      post-splash black screen, or "Tried to register two views with the same
//      name ...". See the dekmantel metro.config.js scar for the full story.
//      Add any new context-providing dep to PIN_FROM_PROJECT.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// `.js` imports in workspace packages should resolve to TS source first.
config.resolver.sourceExts = Array.from(
  new Set(['ts', 'tsx', 'mjs', 'cjs', 'js', 'jsx', 'json', ...config.resolver.sourceExts]),
);

const PIN_FROM_PROJECT = [
  'react',
  'react-dom',
  'react-native',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@tanstack/react-query',
  'react-native-safe-area-context',
  'react-native-gesture-handler',
  'react-native-reanimated',
  'react-native-worklets',
  'react-native-screens',
  'react-native-maps',
  '@react-native-async-storage/async-storage',
  '@react-native-google-signin/google-signin',
  'expo-router',
  'expo-constants',
  'expo-font',
  'expo-linking',
  'expo-splash-screen',
  'expo-status-bar',
  'expo-secure-store',
];

// Resolve each pinned package to its DIRECTORY (not its Node `main` entry) so
// Metro applies its own field priority (`react-native` > `source` > `main`).
// Pinning the Node entry leaves the rest of the bundle resolving to Metro's
// entry — same package, two physical files, double side-effects.
const SINGLETON_DIRS = {};
for (const name of PIN_FROM_PROJECT) {
  const isSubPath = name.startsWith('@') ? name.split('/').length > 2 : name.includes('/');
  if (isSubPath) continue;
  try {
    const entry = require.resolve(name, { paths: [projectRoot] });
    let dir = path.dirname(entry);
    let pkgRoot = null;
    while (dir !== path.dirname(dir)) {
      try {
        const pkg = require(path.join(dir, 'package.json'));
        if (pkg.name === name) {
          pkgRoot = dir;
          break;
        }
      } catch {
        /* keep walking */
      }
      dir = path.dirname(dir);
    }
    if (!pkgRoot) {
      throw new Error(`could not locate package root for '${name}' from ${entry}`);
    }
    SINGLETON_DIRS[name] = pkgRoot;
  } catch (err) {
    // Fail loudly at Metro startup rather than silently bundling two copies.
    throw new Error(
      `metro.config.js: unable to pin '${name}' — is it installed in apps/mobile? (${
        err && err.message ? err.message : err
      })`,
    );
  }
}
const SINGLETON_PREFIXES = Object.entries(SINGLETON_DIRS)
  .map(([name, dir]) => ({ prefix: name + '/', dir }))
  .sort((a, b) => b.prefix.length - a.prefix.length);

const originalResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (SINGLETON_DIRS[moduleName]) {
    return context.resolveRequest(context, SINGLETON_DIRS[moduleName], platform);
  }
  for (const { prefix, dir } of SINGLETON_PREFIXES) {
    if (moduleName.startsWith(prefix)) {
      const subPath = moduleName.slice(prefix.length);
      return context.resolveRequest(context, path.join(dir, subPath), platform);
    }
  }
  // Probe .ts/.tsx for explicit .js imports, but only for our own workspace
  // files (third-party .js imports must not get the TS-source probe).
  if (moduleName.endsWith('.js') && !context.originModulePath.includes('node_modules')) {
    for (const ext of ['.ts', '.tsx']) {
      const candidate = moduleName.replace(/\.js$/, ext);
      try {
        return context.resolveRequest(context, candidate, platform);
      } catch {
        /* fall through */
      }
    }
  }
  if (originalResolve) return originalResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
