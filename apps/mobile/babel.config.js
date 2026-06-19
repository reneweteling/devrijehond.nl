module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-worklets / reanimated must be LAST in the plugin list.
      'react-native-worklets/plugin',
    ],
  };
};
