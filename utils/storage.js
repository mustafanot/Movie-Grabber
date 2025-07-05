// utils/storage.js
window.Storage = {
  get: async function(key) {
    const res = await browser.storage.local.get(key);
    return res[key];
  },
  set: async function(key, value) {
    const obj = {};
    obj[key] = value;
    await browser.storage.local.set(obj);
  }
};