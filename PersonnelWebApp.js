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

    // Main toolbar launcher and global Escape handling load near the end.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("Stage1ReportLauncherAndEscapeJS")
      .getContent();

    // Layout selector extends the final report dialog.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentLayoutChoiceJS")
      .getContent();

    // Transfer Queue captures the final report payload.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("TransferQueueJS")
      .getContent();

    // Queue cancellation extends the Transfer Queue controls.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("TransferQueueCancelPatchJS")
      .getContent();

    // New reports receive today's date; edited reports retain their date.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentTodayDatePatchJS")
      .getContent();

    // Legacy Office + Camp labels.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("DestinationCampChipsJS")
      .getContent();

    // Camp and Office destination option chips.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentDestinationCampFilterJS")
      .getContent();

    // Step 1 can return to Personnel Filter to add more personnel.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentAddPersonnelJS")
      .getContent();

    // Explicit Camp-to-Camp / Office-to-Office transfer selection.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentFlexibleDestinationAndSortJS")
      .getContent();

    // Compact Step 1 filters and clickable personnel name area.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentCompactSourceUXJS")
      .getContent();

    // Correct Step 1 Camp/Office subtitles using the active transfer mode.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentSourceSubtitleFixJS")
      .getContent();

    // New Report must discard the edited report and restore the current selection.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentNewReportResetFixJS")
      .getContent();

    // Fixed master destination options and per-group destination changes.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentDestinationMasterAndGroupChangeJS")
      .getContent();
  }

  return content;
}