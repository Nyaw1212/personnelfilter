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

  // Keep the reassignment workspace in separate modules while
  // loading them inside the existing application script block.
  if (filename === "AppJS") {
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
        "ReassignmentGenerateJS"
      )
      .getContent();
  }

  return content;

}
