// utils/clipboard.js
window.Clipboard = {
  copy: function(text) {
    navigator.clipboard.writeText(text)
      .catch(err => console.error("Clipboard write failed:", err));
  }
};