const { createRequire } = require('node:module');

const spatialRequire = createRequire(require.resolve('@acme/spatial'));
const typegpuBabel = spatialRequire.resolve('unplugin-typegpu/babel');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // TypeGPU is owned by @acme/spatial, where the shader source lives.
    // Resolve from that workspace explicitly so pnpm's strict node_modules
    // layout does not make Metro search from apps/mobile and miss the plugin.
    plugins: [typegpuBabel, 'react-native-worklets/plugin'],
  };
};
