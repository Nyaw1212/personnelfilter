//----------------------------------
// Generated Report Quick Preview
//----------------------------------

/**
 * Reads a generated Google Doc and returns a lightweight report preview.
 * Accepts either a Google Docs file ID or a full document URL so older
 * GENERATED_REPORTS rows remain previewable even when Document ID is blank.
 *
 * @param {string} documentReference Google Docs file ID or document URL.
 * @return {Object} Preview metadata and personnel rows.
 */
function getGeneratedReportPreview(documentReference) {
  try {
    const id = extractGeneratedReportDocumentId_(documentReference);

    if (!id) {
      throw new Error(
        "This report does not have a valid Document ID or Google Docs URL."
      );
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

/**
 * Extracts a Drive file ID from either a raw ID or a Google Docs URL.
 *
 * @param {*} value Raw file ID or URL.
 * @return {string} Extracted file ID, or blank when invalid.
 */
function extractGeneratedReportDocumentId_(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  // Standard Google Docs/Drive URLs and raw Apps Script file IDs.
  const match = text.match(/[-\w]{25,}/);
  return match ? match[0] : "";
}
