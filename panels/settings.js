// panels/settings.js

window.initSettings = async function(panel) {
  // inject tooltip & layout CSS
  const style = document.createElement("style");
  style.textContent = `
    .tooltip-icon {
      margin-left:4px;
      color:#007bff;
      cursor:help;
    }
    .settings-row {
      margin-bottom:1em;
    }
    .settings-row label {
      display:inline-block;
      width:140px;
      vertical-align:middle;
    }
    .settings-row input[type="text"],
    .settings-row select {
      width:200px;
    }
    #save-settings, #test-qb {
      margin-right:1em;
      margin-top:0.5em;
    }
    hr { margin:1.5em 0; }
  `;
  document.head.appendChild(style);

  panel.innerHTML = `
    <h2>qBittorrent Settings</h2>
    <div class="settings-row">
      <label>
        qBittorrent URL:
        <span class="tooltip-icon"
              title="Base address of your qBittorrent Web UI, including protocol and port.  
Example: http://192.168.1.10:8080">?</span>
      </label>
      <input type="text" id="qb-url" placeholder="e.g. http://192.168.1.10:8080">
    </div>
    <div class="settings-row">
      <label>
        Username:
        <span class="tooltip-icon"
              title="Your qBittorrent Web UI username.">?</span>
      </label>
      <input type="text" id="qb-username">
    </div>
    <div class="settings-row">
      <label>
        Password:
        <span class="tooltip-icon"
              title="Your qBittorrent Web UI password.">?</span>
      </label>
      <input type="password" id="qb-password">
    </div>
    <button id="test-qb">Test Connectivity</button>
    <span id="qb-test-msg" style="font-style:italic;color:#555"></span>

    <hr>

    <h2>YTS Settings</h2>
    <div class="settings-row">
      <label>
        Category:
        <span class="tooltip-icon"
              title="When sending to qBittorrent, this folder name will be used under your download path.">?</span>
      </label>
      <input type="text" id="yts-category" placeholder="e.g. kids">
    </div>
    <div class="settings-row">
      <label>
        Group by Year?
        <span class="tooltip-icon"
              title="If checked, movies will be placed in subfolders by decade.">?</span>
      </label>
      <input type="checkbox" id="yts-group-year">
    </div>
    <div class="settings-row">
      <label>
        Quality Preference:
        <span class="tooltip-icon"
              title="Best available: try 2160p→1080p→720p;  
Only 2160p: skip lower;  
Only 1080p: skip lower.">?</span>
      </label>
      <select id="yts-quality-pref">
        <option value="best">Best available</option>
        <option value="2160p">Only 2160p</option>
        <option value="1080p">Only 1080p</option>
      </select>
    </div>
    <div class="settings-row">
      <label>
        File Type:
        <span class="tooltip-icon"
              title="Choose whether to push a magnet link or the .torrent file itself to qBittorrent.">?</span>
      </label>
      <select id="yts-file-type">
        <option value="magnet">Magnet link</option>
        <option value="torrent">.torrent file</option>
      </select>
    </div>

    <button id="save-settings">Save Settings</button>
    <span id="settings-msg" style="font-style:italic;color:#555"></span>
  `;

  // element refs
  const urlInp     = panel.querySelector("#qb-url");
  const userInp    = panel.querySelector("#qb-username");
  const passInp    = panel.querySelector("#qb-password");
  const testBtn    = panel.querySelector("#test-qb");
  const testMsg    = panel.querySelector("#qb-test-msg");
  const saveBtn    = panel.querySelector("#save-settings");
  const saveMsg    = panel.querySelector("#settings-msg");

  const categoryEl = panel.querySelector("#yts-category");
  const groupYear  = panel.querySelector("#yts-group-year");
  const qualityEl  = panel.querySelector("#yts-quality-pref");
  const fileTypeEl = panel.querySelector("#yts-file-type");

  // load stored settings
  const [
    sUrl, sUser, sPass,
    sCat, sGrp, sQual, sFile
  ] = await Promise.all([
    Storage.get("qbUrl"),
    Storage.get("qbUsername"),
    Storage.get("qbPassword"),
    Storage.get("ytsCategory"),
    Storage.get("ytsGroupByYear"),
    Storage.get("ytsQualityPref"),
    Storage.get("ytsFileType")
  ]);

  if (sUrl)     urlInp.value     = sUrl;
  if (sUser)    userInp.value    = sUser;
  if (sPass)    passInp.value    = sPass;
  if (sCat)     categoryEl.value = sCat;
  if (sGrp)     groupYear.checked = sGrp;
  if (sQual)    qualityEl.value  = sQual;
  if (sFile)    fileTypeEl.value = sFile;

  // Test connectivity logic unchanged…
  testBtn.addEventListener("click", async () => {
    testMsg.textContent = "";
    const base = urlInp.value.trim().replace(/\/$/, "");
    const usr  = userInp.value.trim();
    const pwd  = passInp.value;
    if (!base || !usr) {
      testMsg.textContent = "Enter URL, username and password.";
      return;
    }
    testMsg.textContent = "Testing…";
    try {
      const login = await fetch(base + "/api/v2/auth/login", {
        method: "POST",
        headers: {"Content-Type":"application/x-www-form-urlencoded"},
        credentials: "include",
        body: `username=${encodeURIComponent(usr)}&password=${encodeURIComponent(pwd)}`
      });
      if (!login.ok) throw new Error(`Login ${login.status}`);
      const verRes = await fetch(base + "/api/v2/app/version", { credentials:"include" });
      if (!verRes.ok) throw new Error(`Version ${verRes.status}`);
      const verTxt = await verRes.text();
      testMsg.textContent = `Connected! qB v${verTxt}`;
    } catch (e) {
      console.error(e);
      testMsg.textContent = `Connection error: ${e.message}`;
    }
  });

  // Save all settings
  saveBtn.addEventListener("click", async () => {
    await Storage.set("qbUrl",            urlInp.value.trim());
    await Storage.set("qbUsername",       userInp.value.trim());
    await Storage.set("qbPassword",       passInp.value);
    await Storage.set("ytsCategory",      categoryEl.value.trim());
    await Storage.set("ytsGroupByYear",   groupYear.checked);
    await Storage.set("ytsQualityPref",   qualityEl.value);
    await Storage.set("ytsFileType",      fileTypeEl.value);

    saveMsg.textContent = "Settings saved!";
    setTimeout(()=> saveMsg.textContent = "", 2000);
  });
};