const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

const modules = [
  "PlatformAssignmentCoreJS.html",
  "PlatformAssignmentEngineV2JS.html",
  "PlatformCoreJS.html",
  "PlatformDirectoryEngineJS.html",
  "PlatformFilterEngineV2JS.html",
  "PlatformGeneratorEngineJS.html",
  "PlatformGlassGreenThemeJS.html",
  "PlatformKeyboardEngineJS.html",
  "PlatformLegacyEngineAdaptersJS.html",
  "PlatformNameFormatEngineJS.html",
  "PlatformReportEngineJS.html",
  "PlatformReportLauncherUXJS.html",
  "PlatformReportPreviewUIJS.html",
  "PlatformReportQueueBridgeJS.html",
  "PlatformSelectionEngineV2JS.html",
  "PlatformSortEngineJS.html",
  "PlatformTransferApplyLocalJS.html",
  "PlatformTransferQueueEngineJS.html",
  "PlatformUIControlBridgeFixJS.html",
  "ReassignmentPluginV1GroupChangeFixJS.html",
  "ReassignmentPluginV1JS.html",
  "ReassignmentPluginV1Phase2JS.html",
  "ReassignmentPluginV1Phase3JS.html",
  "ReassignmentPluginV1PolishJS.html",
  "TransferQueuePluginV1JS.html",
];

function isWrapped(source) {
  return /^\s*<script(?:\s[^>]*)?>[\s\S]*<\/script>\s*$/i.test(source);
}

let wrapped = 0;
let unchanged = 0;

for (const name of modules) {
  const filePath = path.join(root, name);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing platform module: ${name}`);
  }

  const source = fs.readFileSync(filePath, "utf8");
  if (isWrapped(source)) {
    unchanged += 1;
    continue;
  }

  const normalized = source.replace(/^\uFEFF/, "").trim();
  fs.writeFileSync(filePath, `<script>\n${normalized}\n</script>\n`, "utf8");
  wrapped += 1;
}

console.log(`Wrapped ${wrapped} platform modules; ${unchanged} already wrapped.`);
