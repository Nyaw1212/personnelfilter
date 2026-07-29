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

    // Loaded after the workspace modules to provide more robust
    // source-office field detection.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentSourceOfficePatchJS"
      )
      .getContent();

    // Adds a Clear Personnel button to the report details dialog.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentClearPatchJS"
      )
      .getContent();

    // Adds Clear All Selected directly to Step 1 of the workspace.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentWorkspaceClearJS"
      )
      .getContent();

    // Saves order/signing details through refreshes and clears both
    // the form and selected personnel after successful generation.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentFormPersistencePatchJS"
      )
      .getContent();

    // Adds the live order preview, polishes workspace controls, and
    // removes duplicated rank prefixes before sending.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "ReassignmentPreviewPolishJS"
      )
      .getContent();

    // Loaded last so successful generation returns to Personnel Filter
    // and generated reports can be reviewed from the main header.
    content += "\n" + HtmlService
      .createHtmlOutputFromFile(
        "GeneratedReportsJS"
      )
      .getContent();
  }

  return content;

}
