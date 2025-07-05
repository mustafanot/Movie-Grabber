// panels/about.js
console.log("🛠 panels/about.js loaded");

window.initAbout = function(panel) {
  console.log("🛠 initAbout() called");
  panel.innerHTML = `
    <h2>About</h2>
    <p>Movie Grabber v1.0.0</p>
    <p>Created by Mustafa</p>
  `;
};