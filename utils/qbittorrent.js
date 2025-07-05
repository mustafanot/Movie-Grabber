// utils/qbittorrent.js

window.QBittorrent = {
  // magnet‐based add
  addTorrent: async function(magnet, savepath = "", category = "") {
    console.log("🧲 addTorrent()", magnet, "savepath→", savepath, "category→", category);
    const base = (await Storage.get("qbUrl") || "").replace(/\/$/, "");
    if (!base) throw new Error("No qBittorrent URL set");

    const form = new URLSearchParams();
    form.append("urls", magnet);
    if (savepath)   form.append("savepath", savepath);
    if (category)   form.append("category", category);

    const resp = await fetch(base + "/api/v2/torrents/add", {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/x-www-form-urlencoded" },
      body:        form.toString()
    });
    console.log("🧲 response status:", resp.status);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Add magnet failed (${resp.status}): ${txt}`);
    }
  },

  // file‐upload add
  addTorrentFile: async function(blob, filename, savepath = "", category = "") {
    console.log("🧲 addTorrentFile()", filename, "savepath→", savepath, "category→", category);
    const base = (await Storage.get("qbUrl") || "").replace(/\/$/, "");
    if (!base) throw new Error("No qBittorrent URL set");

    const form = new FormData();
    form.append("torrents", blob, filename);
    if (savepath)   form.append("savepath", savepath);
    if (category)   form.append("category", category);

    const resp = await fetch(base + "/api/v2/torrents/add", {
      method:      "POST",
      credentials: "include",
      body:        form
    });
    console.log("🧲 response status:", resp.status);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => "");
      throw new Error(`Add .torrent failed (${resp.status}): ${txt}`);
    }
  }
};
