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

    // Final Step 2 layout: Camp selector first, then the existing Office list.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentDestinationCampFilterJS")
      .getContent();

    // Step 1 can return to Personnel Filter to add more personnel.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentAddPersonnelJS")
      .getContent();

    // Legacy flexible destination behavior.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentFlexibleDestinationAndSortJS")
      .getContent();

    // Final workflow behavior: transfer type, sorting, name composition,
    // editable Step 3 destinations, and freehand drag ordering.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentWorkflowOptionsJS")
      .getContent();

    // Runtime safety fix for Step 3 sorting/rendering.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentWorkflowRenderHotfixJS")
      .getContent();

    // Step 2 uses static Camp and Office destination choices.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentStaticDestinationOptionsJS")
      .getContent();

    // Final safe Step 3 UI: grouped destination columns with compact draggable rows.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile("ReassignmentGroupedCompactSafeJS")
      .getContent();
  }

  return content;
}