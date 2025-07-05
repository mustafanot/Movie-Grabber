// popup.js
console.log("✅ popup.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOMContentLoaded in popup.js");

  const tabs   = document.querySelectorAll("#main-menu button");
  const panels = document.querySelectorAll(".tab-panel");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      panels.forEach(p => p.classList.remove("active"));
      document.getElementById(tab.dataset.tab + "-panel")
              .classList.add("active");
    });
  });

  // Call each panel’s initXxx if it exists
  if (typeof window.initAction   === "function")
    window.initAction(document.getElementById("action-panel"));
  if (typeof window.initReports  === "function")
    window.initReports(document.getElementById("reports-panel"));
  if (typeof window.initSettings === "function")
    window.initSettings(document.getElementById("settings-panel"));
  if (typeof window.initAbout    === "function")
    window.initAbout(document.getElementById("about-panel"));
});