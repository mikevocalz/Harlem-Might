const { createRequire } = require('node:module');

const spatialRequire = createRequire(require.resolve('@acme/spatial'));
const typegpuBabel = spatialRequire.resolve('unplugin-typegpu/babel');

module.exports = (api) => {
  api.cache(true);

  return {
    presets: ['next/babel'],
    // The TypeGPU shader source and compiler dependency live in @acme/spatial.
    // Resolve from that workspace so pnpm's peer-context linking is identical
    // for Next and Expo instead of depending on app-level hoisting.
    plugins: [typegpuBabel],
  };
};
