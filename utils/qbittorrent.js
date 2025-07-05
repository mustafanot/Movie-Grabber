// utils/qbittorrent.js

window.QBittorrent = {
  // magnet download
  addTorrent: async function(magnet, savepath = "") {
    const base = (await Storage.get("qbUrl") || "").replace(/\/$/, "");
    if (!base) throw new Error("No qBittorrent URL set");

    // build URL‐encoded form
    const form = new URLSearchParams();
    form.append("urls", magnet);
    if (savepath) form.append("savepath", savepath);

    const resp = await fetch(base + "/api/v2/torrents/add", {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/x-www-form-urlencoded" },
      body:        form.toString()
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(()=>"");
      throw new Error(`Add magnet failed (${resp.status}): ${txt}`);
    }
  },

  // .torrent‐file download
  addTorrentFile: async function(blob, filename, savepath = "") {
    const base = (await Storage.get("qbUrl") || "").replace(/\/$/, "");
    if (!base) throw new Error("No qBittorrent URL set");

    // build multipart form
    const form = new FormData();
    form.append("torrents", blob, filename);
    if (savepath) form.append("savepath", savepath);

    const resp = await fetch(base + "/api/v2/torrents/add", {
      method:      "POST",
      credentials: "include",
      body:        form
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(()=>"");
      throw new Error(`Add .torrent failed (${resp.status}): ${txt}`);
    }
  }
};