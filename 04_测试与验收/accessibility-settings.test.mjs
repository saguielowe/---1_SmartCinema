import assert from "node:assert/strict";

const memory = new Map();
globalThis.localStorage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(key, String(value));
  },
  removeItem(key) {
    memory.delete(key);
  },
};

const { store } = await import("../03_源码/js/store.js");

try {
  store.initStore();
  assert.equal(store.login("testuser", "123456").success, true);

  const settings = {
    enabled: true,
    largeText: true,
    highContrast: true,
    colorBlindFriendly: false,
    reduceMotion: true,
    voicePrompt: false,
    theme: "violet",
  };
  assert.equal(store.setAccessibilitySettings(settings).success, true);

  store.logout();
  assert.equal(store.login("testuser", "123456").success, true);
  assert.deepEqual(store.getCurrentUser().accessibilityMode, settings);
  console.log("accessibility settings persistence tests passed");
} finally {
  store.clearAllData();
}
