// == Movie Grabber: Action Panel ==
// == Author: Mustafa ==
// == Description: Handles UI and logic for fetching and sending torrents ==

console.log("🛠 panels/action.js loaded");

// == Init Panel ==
window.initAction = function(panel) {
  panel.innerHTML = `
    <h2>Action</h2>
    <div id="mode-switch" style="margin-bottom:1em;">
      <button id="mode-tabs"  class="active">From Open Tabs</button>
      <button id="mode-browse">From Browse Results</button>
    </div>
    <div id="actions">
      <div id="tabs-mode">
        <button id="fetch-tabs">Fetch & Filter from Tabs</button>
      </div>
      <div id="browse-mode" style="display:none">
        <button id="fetch-browse">Fetch & Filter from Browse</button>
      </div>
    </div>
    <p id="status-line" style="font-style:italic;color:#555;margin-top:1em">
      Select a mode and click Fetch…
    </p>
    <div id="results" style="margin-top:0.5em"></div>
    <div id="actions-end" style="margin-top:1em">
      <button id="copy-all" disabled>Copy All</button>
      <button id="send-all" disabled>Send All to qB</button>
    </div>
  `;

  const btnTabs   = panel.querySelector("#mode-tabs");
  const btnBrowse = panel.querySelector("#mode-browse");
  const divTabs   = panel.querySelector("#tabs-mode");
  const divBrowse = panel.querySelector("#browse-mode");
  const status    = panel.querySelector("#status-line");

  btnTabs.addEventListener("click", () => {
    btnTabs.classList.add("active");
    btnBrowse.classList.remove("active");
    divTabs.style.display   = "";
    divBrowse.style.display = "none";
    status.textContent = "Running in Tabs mode…";
  });

  btnBrowse.addEventListener("click", () => {
    btnBrowse.classList.add("active");
    btnTabs.classList.remove("active");
    divTabs.style.display   = "none";
    divBrowse.style.display = "";
    status.textContent = "Running in Browse mode…";
  });

  panel.querySelector("#fetch-tabs")
       .addEventListener("click", () => runTabsFetch(panel));
  panel.querySelector("#fetch-browse")
       .addEventListener("click", () => runBrowseFetch(panel));

  panel.querySelector("#copy-all")
       .addEventListener("click", () => {
         copyAll(panel);
         const count = panel.querySelectorAll("#results p").length;
         status.textContent = `Total torrents in clipboard: ${count}`;
       });

  panel.querySelector("#send-all")
       .addEventListener("click", () => sendAll(panel));
};

// == Helpers ==
function disableActions(panel) {
  panel.querySelector("#copy-all").disabled = true;
  panel.querySelector("#send-all").disabled = true;
}

function enableActions(panel) {
  panel.querySelector("#copy-all").disabled = false;
  panel.querySelector("#send-all").disabled = false;
}

function copyAll(panel) {
  const list = Array.from(panel.querySelectorAll("#results p"))
                    .map(p => p.textContent.trim());
  Clipboard.copy(list.join("\n"));
}

function decadeFolder(y) {
  const yr = parseInt(y, 10);
  if (isNaN(yr)) return "";
  const start = Math.floor(yr / 10) * 10;
  return `${start}-${start + 10}`;
}

function extractHashFromUrl(url) {
  const match = url.match(/torrent\/download\/([A-F0-9]+)/i);
  return match ? match[1] : null;
}

function extractHashFromMagnet(magnet) {
  const match = magnet.match(/btih:([A-F0-9]+)/i);
  return match ? match[1] : null;
}

function makeMagnet(hash, displayName) {
  const dn = encodeURIComponent(displayName + " [YTS.MX]");
  const trackers = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.stealth.si:80/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://tracker.dler.org:6969/announce',
    'udp://open.tracker.cl:1337/announce',
    'udp://p4p.arenabg.com:1337/announce',
    'udp://ipv4.tracker.harry.lu:80/announce',
    'https://opentracker.i2p.rocks:443/announce'
  ];
  return 'magnet:?xt=urn:btih:' + hash +
         '&dn=' + dn +
         trackers.map(t => '&tr=' + encodeURIComponent(t)).join('');
}

function pickOneMagnet(links, pref) {
  if (!links.length) return null;
  const has = q => links.find(l => l.quality === q);
  if (pref === "best") return has("2160p") || has("1080p") || null;
  if (["2160p", "1080p"].includes(pref)) return has(pref) || null;
  return null;
}

function pickTorrentFromItems(links, pref) {
  if (!links.length) return null;
  const has = q => links.find(l => l.quality === q);
  if (pref === "best") return has("2160p") || has("1080p") || null;
  if (["2160p", "1080p"].includes(pref)) return has(pref) || null;
  return null;
}
// == Fetch from Open Tabs ==
async function runTabsFetch(panel) {
  const status  = panel.querySelector("#status-line");
  const results = panel.querySelector("#results");
  results.innerHTML = "";
  disableActions(panel);

  const qualityPref = await Storage.get("ytsQualityPref") || "best";
  const tabs = await browser.tabs.query({});
  const movieTabs = tabs.filter(t => /^https?:\/\/yts\.mx\/movies\//.test(t.url));

  if (!movieTabs.length) {
    status.textContent = "No YTS movie tabs open.";
    return;
  }

  let fetched = 0, skipped = 0;
  const items = [];

  for (let i = 0; i < movieTabs.length; i++) {
    const tab = movieTabs[i];
    status.textContent = `Scanning ${i+1}/${movieTabs.length}…`;

    const res = await browser.tabs.executeScript(tab.id, {
      code: `
        (() => {
          const h1 = document.querySelector('#movie-info h1');
          const yearMatch = h1 ? h1.textContent.match(/\\((\\d{4})\\)/) : null;
          const year = yearMatch ? yearMatch[1] : "";
          const title = h1 ? h1.textContent.replace(/\\(\\d{4}\\)/, "").trim() : "";

          const links = Array.from(document.querySelectorAll('.modal-torrent')).map(modal => {
            const qualityEl = modal.querySelector('.modal-quality span');
            const magnetEl = modal.querySelector('a[href^="magnet:"]');
            const quality = qualityEl ? qualityEl.textContent.trim() : "";
            const magnet = magnetEl ? magnetEl.href : "";
            return { quality, magnet };
          }).filter(l => l.magnet);

          return { title, year, links };
        })();
      `
    });

    const data = res[0];
    if (!data || !data.links || !data.links.length) {
      skipped++;
      continue;
    }

    const pick = pickOneMagnet(data.links, qualityPref);
    if (!pick) {
      skipped++;
      results.innerHTML += `<p style="color:#999;font-style:italic">Skipped: ${data.title} (${data.year}) — no ${qualityPref} found</p>`;
      continue;
    }

    items.push({ magnet: pick.magnet, year: data.year });
    fetched++;
  }

  if (!items.length) {
    status.textContent = "Done. No magnets found.";
    return;
  }

  results.innerHTML = items.map(it =>
    `<p style="word-break:break-all" data-year="${it.year}">${it.magnet}</p>`
  ).join("");

  status.textContent = `Done. fetched ${fetched}, skipped ${skipped}.`;
  enableActions(panel);
}

// == Fetch from Browse Results ==
async function runBrowseFetch(panel) {
  const status  = panel.querySelector('#status-line');
  const results = panel.querySelector('#results');
  results.innerHTML = '';
  disableActions(panel);

  const qualityPref = await Storage.get('ytsQualityPref') || 'best';
  const tabs = await browser.tabs.query({});
  const browseTabs = tabs.filter(t => /\/browse-movies/.test(t.url));

  if (!browseTabs.length) {
    status.textContent = 'No Browse pages open.';
    return;
  }

  let fetched = 0, skipped = 0;
  const items = [];

  for (let i = 0; i < browseTabs.length; i++) {
    const tab = browseTabs[i];
    status.textContent = `Scanning ${i+1}/${browseTabs.length}…`;

    const res = await browser.tabs.executeScript(tab.id, {
      code: `
        (() => {
          const results = [];
          document.querySelectorAll('.browse-movie-wrap').forEach(mw => {
            const titleEl = mw.querySelector('.browse-movie-title');
            const yearEl  = mw.querySelector('.browse-movie-year');
            const title   = titleEl ? titleEl.textContent.trim() : "";
            const year    = yearEl ? yearEl.textContent.trim() : "";
            const links   = Array.from(mw.querySelectorAll('.browse-movie-tags a')).map(a => ({
              url: a.href,
              quality: a.title.match(/(2160p|1080p|720p)/)?.[1] || ""
            }));
            results.push({ title, year, links });
          });
          return results;
        })();
      `
    });

    const found = res[0] || [];
    for (const entry of found) {
      const pick = pickTorrentFromItems(entry.links, qualityPref);
      if (!pick) {
        skipped++;
        results.innerHTML += `<p style="color:#999;font-style:italic">Skipped: ${entry.title} (${entry.year}) — no ${qualityPref} found</p>`;
        continue;
      }

      const hash = extractHashFromUrl(pick.url);
      if (!hash) {
        skipped++;
        continue;
      }

      const displayName = entry.year ? `${entry.title} (${entry.year})` : entry.title;
      const magnet = makeMagnet(hash, displayName);
      items.push({ magnet, year: entry.year });
      fetched++;
    }
  }

  if (!items.length) {
    status.textContent = 'Done. No magnets found.';
    return;
  }

  results.innerHTML += items.map(it =>
    `<p style="word-break:break-all" data-year="${it.year}">${it.magnet}</p>`
  ).join("");

  status.textContent = `Done. fetched ${fetched}, skipped ${skipped}.`;
  enableActions(panel);
}
// == Send to qBittorrent ==
async function sendAll(panel) {
  const status  = panel.querySelector("#status-line");
  const results = panel.querySelectorAll("#results p");
  const category = await Storage.get("ytsCategory") || "Movies";
  const groupByYear = await Storage.get("ytsGroupByYear") === true;
  const fileType = await Storage.get("ytsFileType") || "magnet";

  if (!results.length) {
    status.textContent = "Nothing to send.";
    return;
  }

  disableActions(panel);
  status.textContent = "Sending to qBittorrent…";

  let sent = 0, failed = 0;

  for (let i = 0; i < results.length; i++) {
    const el = results[i];
    const magnet = el.textContent.trim();
    const year = el.dataset.year || "";

    // ✅ Final fix: only use decade as subfolder, NOT category
    let savePath = "";
    if (groupByYear && year) {
      const decade = Math.floor(parseInt(year, 10) / 10) * 10;
      savePath = `${decade}-${decade + 10}`;
    }

    try {
      if (fileType === "magnet") {
        await QBittorrent.addTorrent(magnet, savePath, category);
      } else {
        const hash = extractHashFromMagnet(magnet);
        if (!hash) throw new Error("Invalid magnet hash");
        const blob = await fetchTorrentBlob(hash);
        if (!blob) throw new Error("Failed to fetch .torrent");
        await QBittorrent.addTorrentFile(blob, undefined, savePath, category);
      }
      sent++;
    } catch (err) {
      console.error("❌ Failed to send:", magnet, err);
      failed++;
    }
  }

  status.textContent = `Done. Sent ${sent}, failed ${failed}.`;
  enableActions(panel);
}

// == Extract hash from magnet ==
function extractHashFromMagnet(magnet) {
  const match = magnet.match(/btih:([A-F0-9]+)/i);
  return match ? match[1] : null;
}

// == Fetch .torrent Blob ==
async function fetchTorrentBlob(hash) {
  const url = `https://yts.mx/torrent/download/${hash}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.blob();
}
