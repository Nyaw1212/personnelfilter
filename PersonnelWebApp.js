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
// Include HTML File
//----------------------------------

function include(filename) {
  let content = HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();

  if (filename !== "AppJS") return content;

  // Production now loads the same clean platform stack used by Developer Mode.
  // Legacy reassignment patches remain in the Apps Script project only as
  // rollback files and are intentionally not included here.
  const productionModules = [
    // Existing shared production modules that are still required.
    "GeneratedReportsJS",
    "GeneratedReportPreviewJS",
    "Stage1GeneratedReportEditorJS",
    "AOSelectionBulkControlsJS",
    "PerformanceClientJS",
    "TransferQueueJS",
    "TransferQueueCancelPatchJS",

    // Personnel Platform engines.
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

    // Production UI and plugins.
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

  productionModules.forEach(function(moduleName) {
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(moduleName)
      .getContent();
  });

  return content;
}
