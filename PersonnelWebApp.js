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
  // element, insert the wrapped platform modules, then reopen it so the
  // existing closing tag in Index.html remains balanced.
  content += "\n</script>\n" + includePlatformBundle() + "\n<script>\n";

  return content;
}

//----------------------------------
// Personnel Platform production bundle
//----------------------------------

function includePlatformBundle() {
  // Each platform module is a valid HTML partial wrapped in its own <script>
  // element. Joining those partials avoids Apps Script's malformed-HTML error
  // while preserving the same execution order used in Developer Mode.
  const platformModules = [
    "PlatformCoreJS",
    "PlatformPerformanceEngineJS",
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
    "PlatformReportGenerationBridgeJS",
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

  return platformModules.map(function(moduleName) {
    return HtmlService
      .createHtmlOutputFromFile(moduleName)
      .getContent();
  }).join("\n\n");
}
