// Shared jest-expo RSC preset (§4.1) — patched for pnpm's hoisted layout
// (jest-expo's own rsc-expect.ts must be in the transform allowlist).
const preset = require('jest-expo/rsc/jest-preset');
preset.projects = preset.projects.map((p) => ({
  ...p,
  transformIgnorePatterns: p.transformIgnorePatterns?.map((pat) =>
    pat.replace('(?!(.pnpm|', '(?!(.pnpm|jest-expo|'),
  ),
}));
module.exports = preset;
