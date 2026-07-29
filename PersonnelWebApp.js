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

  // Load the generate-dialog module first so it replaces the
  // temporary validation handler before the workspace button
  // attaches its click listener.
  if (filename === "AppJS") {
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentGenerateJS"
      )
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentJS"
      )
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentPatchJS"
      )
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentSourceOfficePatchJS"
      )
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentClearPatchJS"
      )
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentWorkspaceClearJS"
      )
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentFormPersistencePatchJS"
      )
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentPreviewPolishJS"
      )
      .getContent();

    // Loaded after the preview module to keep the preview table synced
    // with the current personnel assignments and form values.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentLivePreviewFixJS"
      )
      .getContent();

    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "GeneratedReportsJS"
      )
      .getContent();

    // Adds an in-app quick scan of generated report personnel rows
    // without opening the Google Doc in a new tab.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "GeneratedReportPreviewJS"
      )
      .getContent();

    // Adds Remove All Visible and Deselect All to the AO toolbar.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "AOSelectionBulkControlsJS"
      )
      .getContent();
  }

  return content;
}