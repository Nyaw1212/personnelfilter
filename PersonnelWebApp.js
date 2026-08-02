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

  // AttendanceCenterJS is a valid standalone HTML partial wrapped in
  // <script> tags. Index currently includes it inside the main script
  // bundle, so return only its JavaScript body there.
  if (filename === "AttendanceCenterJS") {
    return content
      .replace(/^\s*<script(?:\s[^>]*)?>\s*/i, "")
      .replace(/\s*<\/script>\s*$/i, "");
  }

  if (filename !== "AppJS") return content;

  const sharedClientModules = [
    "GeneratedReportsJS",
    "GeneratedReportPreviewJS",
    "Stage1GeneratedReportEditorJS",
    "AOSelectionBulkControlsJS",
    "PerformanceClientJS",
    "PersonnelDataRefreshFixJS",
    "PersonnelTableV2JS",
    "CanonicalTransferQueueClientJS",
    "TransferQueueThemeSyncJS",
    "MultiTextSearchJS",
    "MultiTextSearchPerformanceFixJS",
    "AttendanceCenterUXPatchJS",
    "AttendanceCenterUXHardFixJS",
    "AttendanceCenter70x70PatchJS",
    "AttendanceCenterHoverGuideJS"
  ];

  sharedClientModules.forEach(function(moduleName) {
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(moduleName)
      .getContent();
  });

  content += "\n</script>\n" + includePlatformBundle() + "\n<script>\n";

  return content;
}

//----------------------------------
// Personnel Platform production bundle
//----------------------------------

function includePlatformBundle() {
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
    "PlatformReportPreviewUIJS",
    "ReportSignatoryDirectoryJS",
    "PlatformReportGenerationBridgeJS",
    "ReportGenerationRetrySafetyJS",
    "ReportToastDedupFixJS",
    "ReassignmentPluginV1JS",
    "ReassignmentPluginV1GroupChangeFixJS",
    "ReassignmentPluginV1Phase3JS",
    "PlatformNameHandlerEngineJS",
    "PlatformNameFormatEngineJS",
    "ReassignmentPluginV1PolishJS",
    "ReassignmentRankDisplayFixJS",
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
