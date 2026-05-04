// Ice Encrypt - Config
// NOTE: There is no "built-in secret key" exposed here.
// A fresh random session key is generated in script.js on every page load.
// Users who want a persistent key must use the "Custom Key" option.

window.ICE_CONFIG = {
    version: '2.0',
    maxHistoryItems: 50,
    chunkSize: 1024 * 1024,        // 1 MB
    largeFileThreshold: 50 * 1024 * 1024 // 50 MB
};