//----------------------------------
// Web App Entry Point
//----------------------------------

function doGet() {

  const template =
    HtmlService
      .createTemplateFromFile(
        "Index"
      );

  return template
    .evaluate()
    .setTitle(
      "Personnel Filter"
    )
    .setXFrameOptionsMode(
      HtmlService
        .XFrameOptionsMode
        .ALLOWALL
    );

}

//----------------------------------
// Include HTML File
//----------------------------------

function include(
  filename
) {

  let content = HtmlService
    .createHtmlOutputFromFile(
      filename
    )
    .getContent();

  if (filename === "AppJS") {
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentGenerateJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentPatchJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentSourceOfficePatchJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentClearPatchJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentWorkspaceClearJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentFormPersistencePatchJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentPreviewPolishJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentLivePreviewFixJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("GeneratedReportsJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("GeneratedReportPreviewJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("Stage1GeneratedReportEditorJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("AOSelectionBulkControlsJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("Stage1WorkflowUXJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("PerformanceClientJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("Stage1WorkflowRuntimeFixJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("Stage1GenerateChoiceHardFixJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("Stage1ReportLauncherAndEscapeJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentLayoutChoiceJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("TransferQueueJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("TransferQueueCancelPatchJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentTodayDatePatchJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("DestinationCampChipsJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentDestinationCampFilterJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentAddPersonnelJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentFlexibleDestinationAndSortJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentCompactSourceUXJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentSourceSubtitleFixJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentNewReportResetFixJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentDestinationMasterAndGroupChangeJS")
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentDynamicDestinationDirectoryJS")
      .getContent();

    // Searchable merged Camp/Office directory and Step 3 group reassignment.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentDestinationDirectoryUXJS")
      .getContent();
  }

  return content;
}