const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const devDir = path.join(root, "dev");

function read(name) {
  return fs.readFileSync(path.join(root, name), "utf8");
}

function appJsBundle() {
  const entry = read("PersonnelWebApp.js");

  // Developer Mode now runs the clean Reassignment V1 plugin. These legacy
  // reassignment partials stay in the Apps Script project for production
  // rollback safety, but are no longer bundled into dev/index.html.
  const excludedLegacyReassignment = new Set([
    "ReassignmentGenerateJS",
    "ReassignmentJS",
    "ReassignmentPatchJS",
    "ReassignmentSourceOfficePatchJS",
    "ReassignmentClearPatchJS",
    "ReassignmentWorkspaceClearJS",
    "ReassignmentFormPersistencePatchJS",
    "ReassignmentPreviewPolishJS",
    "ReassignmentLivePreviewFixJS",
    "ReassignmentLayoutChoiceJS",
    "ReassignmentTodayDatePatchJS",
    "ReassignmentDestinationCampFilterJS",
    "ReassignmentAddPersonnelJS",
    "ReassignmentFlexibleDestinationAndSortJS",
    "ReassignmentCompactSourceUXJS",
    "ReassignmentSourceSubtitleFixJS",
    "ReassignmentNewReportResetFixJS",
    "ReassignmentDestinationMasterAndGroupChangeJS",
    "ReassignmentDynamicDestinationDirectoryJS",
    "ReassignmentDestinationDirectoryUXJS",
    "DestinationCampChipsJS",
    "Stage1WorkflowUXJS",
    "Stage1WorkflowRuntimeFixJS",
    "Stage1GenerateChoiceHardFixJS",
    "Stage1ReportLauncherAndEscapeJS",
  ]);

  const names = [...entry.matchAll(/createHtmlOutputFromFile\("([^"]+)"\)/g)]
    .map(match => match[1])
    .filter(name => !excludedLegacyReassignment.has(name));

  const platformPilot = [
    "PlatformCoreJS.html",
    "PlatformLegacyEngineAdaptersJS.html",
    "PlatformSelectionEngineV2JS.html",
    "PlatformFilterEngineV2JS.html",
    "PlatformAssignmentCoreJS.html",
    "PlatformDirectoryEngineJS.html",
    "PlatformSortEngineJS.html",
    "PlatformGeneratorEngineJS.html",
    "PlatformReportEngineJS.html",
    "PlatformTransferQueueEngineJS.html",
    "PlatformTransferApplyLocalJS.html",
    "TransferQueuePluginV1JS.html",
    "PlatformReportPreviewUIJS.html",
    "ReassignmentPluginV1JS.html",
    "ReassignmentPluginV1GroupChangeFixJS.html",
    "ReassignmentPluginV1Phase3JS.html",
    "PlatformReportLauncherUXJS.html",
    "PlatformUIControlBridgeFixJS.html",
    "PlatformKeyboardEngineJS.html",
  ];

  return [
    read("AppJS.html"),
    ...names.map(name => read(`${name}.html`)),
    ...platformPilot.map(read),
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
console.log("Built dev/index.html with KeyboardEngine shortcuts.");
