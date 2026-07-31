const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const devDir = path.join(root, "dev");

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

function appJsBundle() {
  const entry = read("PersonnelWebApp.js");
  const names = [...entry.matchAll(/createHtmlOutputFromFile\("([^"]+)"\)/g)]
    .map(match => match[1]);

  const enginePilot = [
    "ReassignmentEngineLegacyBridgeJS.html",
    "ReassignmentEngineCoreJS.html",
    "ReassignmentEngineControlsJS.html",
    "ReassignmentEngineRendererJS.html",
    "ReassignmentEngineDebugJS.html",
  ];

  return [
    read("AppJS.html"),
    ...names.map(name => read(`${name}.html`)),
    ...enginePilot.map(read),
  ].join("\n\n");
}

function include(name) {
  if (name === "AppJS") return appJsBundle();
  return read(`${name}.html`);
}

let html = read("Index.html");
html = html.replace(/<\?!=\s*include\("([^"]+)"\);?\s*\?>/g, (_, name) => include(name));
html = html.replace(
  "<script>",
  '<script src="./mock-google.js"></script>\n<script>'
);
html = html.replace(
  "</head>",
  '  <meta name="dev-mode" content="true" />\n</head>'
);

fs.mkdirSync(devDir, { recursive: true });
fs.writeFileSync(path.join(devDir, "index.html"), html, "utf8");
console.log("Built dev/index.html with Apps Script includes expanded, ReassignmentEngine pilot, legacy bridge, and diagnostics loaded.");
