//----------------------------------
// Generated Report Quick Preview
//----------------------------------

/**
 * Reads a generated Google Doc and returns a lightweight report preview.
 * Works for both old and newly generated reports as long as Document ID exists.
 *
 * @param {string} documentId Google Docs file ID.
 * @return {Object} Preview metadata and personnel rows.
 */
function getGeneratedReportPreview(documentId) {
  try {
    const id = String(documentId || "").trim();

    if (!id) {
      throw new Error("This report does not have a Document ID.");
    }

    const document = DocumentApp.openById(id);
    const body = document.getBody();
    const tables = body.getTables();

    if (!tables.length) {
      throw new Error("No personnel table was found in the generated report.");
    }

    // The first table in the current reassignment template is the personnel table.
    const table = tables[0];
    const rows = [];

    for (let rowIndex = 1; rowIndex < table.getNumRows(); rowIndex++) {
      const row = table.getRow(rowIndex);
      const cells = [];

      for (let column = 0; column < row.getNumCells(); column++) {
        cells.push(
          String(row.getCell(column).getText() || "")
            .replace(/\s+/g, " ")
            .trim()
        );
      }

      if (cells.some(Boolean)) {
        rows.push({
          number: cells[0] || String(rowIndex),
          rankName: cells[1] || "",
          from: cells[2] || "",
          to: cells[3] || "",
        });
      }
    }

    return {
      success: true,
      documentId: id,
      title: document.getName(),
      rows,
      personnelCount: rows.length,
      message: rows.length
        ? "Report preview loaded."
        : "The report table does not contain personnel rows.",
    };
  } catch (error) {
    console.error("getGeneratedReportPreview error:", error);
    return {
      success: false,
      message: error && error.message
        ? error.message
        : String(error || "Report preview could not be loaded."),
    };
  }
}
