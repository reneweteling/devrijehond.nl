const { withInfoPlist } = require('@expo/config-plugins');

/**
 * App Transport Security is build-type specific.
 *
 * Dev/debug builds (simulator, `expo run:ios`, `expo start`) talk to an
 * http://localhost API and to the Metro dev server, so they need a `localhost`
 * ATS exception. The shipping release build only talks to the public https
 * origin (api.devrijehond.nl) and nothing local.
 *
 * A `localhost` ATS exception (like the older `NSAllowsLocalNetworking`) makes
 * CFNetwork tag the app with `ATSAllowsLocalNetworking`. On recent iOS that tag
 * alone is enough to pop the "find devices on your local network" prompt and to
 * stall DNS while the prompt is pending, even though the app never touches the
 * LAN. So we strip the exception (and NSLocalNetworkUsageDescription, only ever
 * needed if you do prompt) from the RELEASE build, and keep it for dev.
 *
 * The release pipeline (scripts/release-ios.sh) sets DEVRIJEHOND_RELEASE=1
 * before prebuild; that is the single signal that this is the shipping build.
 * Without it (every dev/simulator build) the localhost exception stays, which is
 * harmless: dev builds are never shipped and the simulator doesn't prompt.
 */
module.exports = function withDevAts(config) {
  const isReleaseBuild = process.env.DEVRIJEHOND_RELEASE === '1';

  return withInfoPlist(config, (cfg) => {
    if (isReleaseBuild) {
      delete cfg.modResults.NSAppTransportSecurity;
      delete cfg.modResults.NSLocalNetworkUsageDescription;
    } else {
      cfg.modResults.NSAppTransportSecurity = {
        NSExceptionDomains: {
          localhost: { NSExceptionAllowsInsecureHTTPLoads: true },
        },
      };
    }
    return cfg;
  });
};
