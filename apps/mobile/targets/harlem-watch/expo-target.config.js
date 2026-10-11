/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  // The existing vertical-page UI and scene-phase API require watchOS 10.
  deploymentTarget: '10.0',
  frameworks: ['WatchConnectivity', 'WatchKit'],
  colors: { $accent: '#F8C626' },
};
