const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

if (process.platform === "win32") {
  config.resolver.useWatchman = false;
}

module.exports = config;
