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

  if (filename === "AttendanceCenterJS") {
    return stripOuterScriptTags_(content);
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
    "AttendanceCenterHoverGuideJS",
    "AttendanceReportJS",
    "AttendanceReportTraceJS"
  ];

  sharedClientModules.forEach(function(moduleName) {
    const moduleContent = HtmlService
      .createHtmlOutputFromFile(moduleName)
      .getContent();

    content += "\n" + stripOuterScriptTags_(moduleContent);
  });

  content += "\n</script>\n" + includePlatformBundle() + "\n<script>\n";

  return content;
}

//----------------------------------
// Remove an optional outer script wrapper
//----------------------------------

function stripOuterScriptTags_(content) {
  return String(content || "")
    .replace(/^\s*<script(?:\s[^>]*)?>\s*/i, "")
    .replace(/\s*<\/script>\s*$/i, "");
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
    "ReassignmentPluginV1Step1FilterJS",
    "ReassignmentPluginV1Step1FilterRerenderFixJS",
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
