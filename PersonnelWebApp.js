//----------------------------------
// Web App Entry Point
//----------------------------------

function doGet() {
  const template = HtmlService.createTemplateFromFile("Index");

  return template
    .evaluate()
    .setTitle("Personnel Filter")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

//----------------------------------
// Standard HTML/JavaScript include
//----------------------------------

function include(filename) {
  let content = HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();

  if (filename !== "AppJS") return content;

  // These existing client modules are still part of the base Personnel Filter.
  const sharedClientModules = [
    "GeneratedReportsJS",
    "GeneratedReportPreviewJS",
    "Stage1GeneratedReportEditorJS",
    "AOSelectionBulkControlsJS",
    "PerformanceClientJS",
    "TransferQueueJS",
    "TransferQueueCancelPatchJS"
  ];

  sharedClientModules.forEach(function(moduleName) {
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(moduleName)
      .getContent();
  });

  // Index.html places AppJS inside its original <script> element. Close that
  // element, insert the Apps Script-safe platform bundle, then reopen it so
  // Index.html's existing closing tag remains balanced.
  content += "\n</script>\n" + includePlatformBundle() + "\n<script>\n";

  return content;
}

//----------------------------------
// Personnel Platform production bundle
//----------------------------------

function includePlatformBundle() {
  // These files contain plain browser JavaScript rather than complete HTML.
  // Bundle them into one valid script element for Apps Script production.
  const platformModules = [
    "PlatformCoreJS",
    "PlatformLegacyEngineAdaptersJS",
    "PlatformSelectionEngineV2JS",
    "PlatformFilterEngineV2JS",
    "PlatformAssignmentCoreJS",
    "PlatformDirectoryEngineJS",
    "PlatformSortEngineJS",
    "PlatformGeneratorEngineJS",
    "PlatformReportEngineJS",
    "PlatformTransferQueueEngineJS",
    "TransferQueuePluginV1JS",
    "PlatformReportPreviewUIJS",
    "PlatformReportQueueBridgeJS",
    "ReassignmentPluginV1JS",
    "ReassignmentPluginV1GroupChangeFixJS",
    "ReassignmentPluginV1Phase3JS",
    "PlatformNameFormatEngineJS",
    "ReassignmentPluginV1PolishJS",
    "PlatformReportLauncherUXJS",
    "PlatformUIControlBridgeFixJS",
    "PlatformKeyboardEngineJS",
    "PlatformGlassGreenThemeJS"
  ];

  const source = platformModules.map(function(moduleName) {
    return HtmlService
      .createHtmlOutputFromFile(moduleName)
      .getContent();
  }).join("\n\n");

  const safeSource = source.replace(/<\/script/gi, "<\\/script");
  return "<script>\n" + safeSource + "\n<\/script>";
}
