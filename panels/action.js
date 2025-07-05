// panels/action.js

console.log("🛠 panels/action.js loaded");

window.initAction = function(panel) {
  console.log("🛠 initAction() called");

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


// MODE A: From Open Tabs (with progress & logs)
async function runTabsFetch(panel) {
  const status  = panel.querySelector("#status-line");
  const results = panel.querySelector("#results");
  results.innerHTML = "";
  disableActions(panel);

  const quality   = await Storage.get("qualitySetting") || "all";
  const tabs      = await browser.tabs.query({});
  const pageTabs = tabs.filter(t =>
    /^https?:\/\/yts\.mx\/movies\//.test(t.url)
  );


  if (!pageTabs.length) {
    status.textContent = "No pages to scan.";
    return;
  }

  let fetched = 0, skipped = 0, errors = 0;
  const allMagnets = [];

  for (let i = 0; i < pageTabs.length; i++) {
    const tab = pageTabs[i];
    console.log(`🏷️ [Tabs] processing ${tab.url}`);
    status.textContent = `Fetching tab ${i+1}/${pageTabs.length}… ` +
                         `(fetched ${fetched}, skipped ${skipped}, errors ${errors})`;

    try {
      const res = await browser.tabs.executeScript(tab.id, {
        code: `
          Array.from(document.querySelectorAll('a[href^="magnet:"]'))
               .map(a => a.href);
        `
      });
      const raw = res[0] || [];
      console.log(`🔗 [Tabs] found ${raw.length} magnet(s)`);

      const parsed = raw.map(parseMagnetLink);
      const groups = parsed.reduce((acc,m) => {
        (acc[m.title] = acc[m.title]||[]).push(m);
        return acc;
      }, {});
      const picks = Object.values(groups)
                          .map(g => pickMagnetFromList(g, quality))
                          .filter(Boolean);

      if (picks.length) {
        fetched += picks.length;
        allMagnets.push(...picks);
      } else {
        skipped++;
      }
    } catch (e) {
      console.error("❌ [Tabs] error on", tab.url, e);
      errors++;
    }
  }

  if (!allMagnets.length) {
    status.textContent = `Done. No magnets found for "${quality}".`;
  } else {
    results.innerHTML = allMagnets
      .map(m => `<p style="word-break:break-all">${m}</p>`)
      .join("");
    status.textContent = `Done. fetched ${fetched}, skipped ${skipped}, errors ${errors}.`;
    enableActions(panel);
  }
}


// MODE B: From Browse Results (with progress)
async function runBrowseFetch(panel) {
  const status    = panel.querySelector("#status-line");
  const results   = panel.querySelector("#results");
  results.innerHTML = "";
  disableActions(panel);

  const quality   = await Storage.get("qualitySetting") || "all";
  const tabs      = await browser.tabs.query({});
  const browseTabs = tabs.filter(t => /\/browse-movies/.test(t.url));

  if (!browseTabs.length) {
    status.textContent = "No Browse pages open.";
    return;
  }

  let fetched = 0, skipped = 0, errors = 0;
  const allMagnets = [];

  for (let i = 0; i < browseTabs.length; i++) {
    const tab = browseTabs[i];
    console.log(`🏷️ [Browse] processing ${tab.url}`);
    status.textContent = `Scanning ${i+1}/${browseTabs.length}… ` +
                         `(fetched ${fetched}, skipped ${skipped}, errors ${errors})`;

    try {
      const res = await browser.tabs.executeScript(tab.id, {
        code: `
          (() => {
            const movies = [];
            document.querySelectorAll('.browse-movie-wrap').forEach(mw => {
              const tEl = mw.querySelector('.browse-movie-title');
              const title = tEl ? tEl.textContent.trim() : '';
              const items = Array.from(
                mw.querySelectorAll('.browse-movie-tags a')
              ).map(a => ({ url:a.href, quality:a.textContent.trim() }));
              if (title && items.length) movies.push({ title, items });
            });
            return movies;
          })();
        `
      });
      const movies = res[0] || [];

      movies.forEach(({ title, items }) => {
        const pickUrl = pickTorrentFromItems(items, quality);
        if (pickUrl) {
          const magnet = makeMagnet(
            pickUrl,
            title,
            extractResFromUrl(pickUrl)
          );
          allMagnets.push(magnet);
          fetched++;
        } else {
          skipped++;
        }
      });
    } catch (e) {
      console.error("❌ [Browse] error on", tab.url, e);
      errors++;
    }
  }

  if (!allMagnets.length) {
    status.textContent = `Done. No magnets found for "${quality}".`;
  } else {
    results.innerHTML = allMagnets
      .map(m => `<p style="word-break:break-all">${m}</p>`)
      .join("");
    status.textContent = `Done. fetched ${fetched}, skipped ${skipped}, errors ${errors}.`;
    enableActions(panel);
  }
}


// SEND ALL → real qBittorrent API calls
// Replace your old sendAll(...) with this

async function sendAll(panel) {
  const status  = panel.querySelector("#status-line");
  const magnets = Array.from(panel.querySelectorAll("#results p"))
                       .map(p => p.textContent.trim());

  if (!magnets.length) {
    status.textContent = "No torrents to send.";
    return;
  }

  // load your YTS settings
  const [
    category,
    groupByYear,
    qualityPref,
    fileType
  ] = await Promise.all([
    Storage.get("ytsCategory")    || "",
    Storage.get("ytsGroupByYear") || false,
    Storage.get("ytsQualityPref") || "best",
    Storage.get("ytsFileType")    || "magnet"
  ]);

  // helper to compute decade folder
  function decadeFolder(year) {
    const y = parseInt(year, 10);
    if (isNaN(y)) return null;
    const start = Math.floor(y / 10) * 10;
    const end   = (start + 10 < new Date().getFullYear())
                ? start + 10
                : "now";
    return `${start}-${end}`;
  }

  status.textContent = `Sending ${magnets.length} torrents…`;
  let sent = 0, fail = 0;

  for (let magnet of magnets) {
    try {
      // parse dn=… for title & year
      const url = new URL(magnet);
      const dn  = decodeURIComponent(url.searchParams.get("dn") || "");
      const parts = dn.split(" [");
      const title = parts[0];
      const year  = (dn.match(/(19|20)\d{2}/) || [])[0] || "";

      // build savepath: "category[/decade]"
      let savepath = "";
      if (category) {
        savepath += category;
        if (groupByYear && year) {
          const dec = decadeFolder(year);
          if (dec) savepath += "/" + dec;
        }
      } else if (groupByYear && year) {
        const dec = decadeFolder(year);
        if (dec) savepath = dec;
      }

      // push to qBittorrent
      if (fileType === "magnet") {
        await QBittorrent.addTorrent(magnet, savepath);
      } else {
        // fetch .torrent file from YTS
        const hi = magnet.match(/xt=urn:btih:([A-F0-9]+)/i);
        if (!hi) throw new Error("Invalid magnet");
        const torrentUrl = `https://yts.mx/torrent/download/${hi[1]}`;
        const resp       = await fetch(torrentUrl);
        if (!resp.ok) throw new Error("Torrent fetch failed");
        const blob  = await resp.blob();
        const fname = title.replace(/[\/:*?"<>|]/g, "") + ".torrent";
        await QBittorrent.addTorrentFile(blob, fname, savepath);
      }

      sent++;
    }
    catch (e) {
      console.error("❌ sendAll failed:", e);
      fail++;
    }
    status.textContent = `Sent ${sent}/${magnets.length}, failed ${fail}`;
  }

  status.textContent = `Done. Sent ${sent}, failed ${fail}.`;
}


// HELPERS

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
                    .map(p => p.textContent);
  Clipboard.copy(list.join("\n"));
}

function parseMagnetLink(magnet) {
  const url   = new URL(magnet);
  const dn    = url.searchParams.get("dn") || "";
  const parts = dn.split(".");
  const res   = parts.find(p => /^(2160p|1080p|720p|480p)$/.test(p)) || "unknown";
  const src   = parts.find(p => /BluRay|WEBx?/.test(p)) || "";
  const idx   = parts.indexOf(res);
  const title = idx > 0
    ? parts.slice(0, idx).join(" ")
    : (dn || magnet);
  return { magnet, title, res, src };
}

function pickMagnetFromList(items, pref) {
  if (!items.length) return null;
  const score = r => parseInt(r, 10) || 0;
  const sourceOrder = ["BluRay","WEBx265","WEB",""];
  let cand = items.slice();

  if (pref !== "all" && pref !== "highest") {
    const byQ = cand.filter(i => i.res === pref);
    if (byQ.length) cand = byQ;
    else return null;
  }
  if (pref === "highest") {
    const best = Math.max(...cand.map(i => score(i.res)));
    cand = cand.filter(i => score(i.res) === best);
  }
  for (let src of sourceOrder) {
    const f = cand.find(i => i.src.includes(src));
    if (f) return f.magnet;
  }
  return cand[0].magnet;
}

function pickTorrentFromItems(items, pref) {
  if (!items.length) return null;
  const score = q => parseInt(q, 10) || 0;
  let cand = items.slice();

  if (pref !== "all" && pref !== "highest") {
    const byQ = cand.filter(i => i.quality === pref);
    if (byQ.length) cand = byQ;
    else return null;
  }
  if (pref === "highest") {
    const best = Math.max(...cand.map(i => score(i.quality)));
    cand = cand.filter(i => score(i.quality) === best);
  }
  return cand[0] ? cand[0].url : null;
}

function extractResFromUrl(url) {
  const m = url.match(/\/(\d+p)/);
  return m ? m[1] : "unknown";
}

function makeMagnet(torrentUrl, title, res) {
  const m     = torrentUrl.match(/torrent\/download\/([A-F0-9]+)/i);
  const hash  = m && m[1];
  if (!hash) return null;

  const dn = encodeURIComponent(`${title} [${res}] [YTS.MX]`);
  const trackers = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.tracker.cl:1337/announce',
    'udp://p4p.arenabg.com:1337/announce',
    'udp://tracker.torrent.eu.org:451/announce',
    'udp://tracker.dler.org:6969/announce',
    'udp://open.stealth.si:80/announce',
    'udp://ipv4.tracker.harry.lu:80/announce',
    'https://opentracker.i2p.rocks:443/announce'
  ];

  return 'magnet:?xt=urn:btih:' + hash
       + '&dn=' + dn
       + trackers.map(t => '&tr='+encodeURIComponent(t)).join('');
}
