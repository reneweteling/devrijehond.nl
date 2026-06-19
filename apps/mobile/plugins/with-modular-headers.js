/**
 * Expo config plugin: add `use_modular_headers!` to the generated iOS Podfile.
 *
 * Google Sign-In pulls in AppCheckCore, which depends on GoogleUtilities and
 * RecaptchaInterop. Those don't define modules, so integrating them as static
 * libraries fails on a clean `pod install` (e.g. on the CI runner) with
 * "Swift pods cannot yet be integrated as static libraries". Enabling modular
 * headers globally generates the module maps and resolves it. Additive and
 * idempotent, so it's safe across prebuilds and local installs.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfile, 'utf8');
      if (!contents.includes('use_modular_headers!')) {
        contents = contents.replace(/(platform :ios[^\n]*\n)/, '$1use_modular_headers!\n');
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
