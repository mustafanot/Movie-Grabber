// content_scripts/magnets.js
console.log("💥 magnets.js loaded on", location.href);

browser.runtime.onMessage.addListener(msg => {
  console.log("📨 magnets.js got message", msg);
  if (msg.action === "getMagnets") {
    const links = Array.from(
      document.querySelectorAll('a[href^="magnet:"]')
    ).map(a => a.href);
    console.log("🔗 Found magnets:", links);
    return Promise.resolve({ magnets: links });
  }
});