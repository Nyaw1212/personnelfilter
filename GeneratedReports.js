//----------------------------------
// Generated Reports Log
//----------------------------------

const GENERATED_REPORTS_CONFIG = Object.freeze({
  sheetName: "GENERATED_REPORTS",
  headers: [
    "Generated At",
    "Report Type",
    "Order Number",
    "Order Date",
    "Signing Officer",
    "Signing Position",
    "Personnel Count",
    "Document Name",
    "Document URL",
    "Document ID",
    "File Reference",
  ],
});

function setupGeneratedReportsSheet() {
  const sheet = getGeneratedReportsSheet_();
  return {
    success: true,
    sheetName: sheet.getName(),
    message: "Generated Reports log is ready.",
  };
}

function logGeneratedReport_(payload, result) {
  const sheet = getGeneratedReportsSheet_();
  const personnel = Array.isArray(payload && payload.personnel)
    ? payload.personnel
    : [];

  sheet.appendRow([
    new Date(),
    "REASSIGNMENT",
    String(payload && payload.orderNumber || "").trim(),
    String(payload && payload.orderDate || "").trim(),
    String(payload && payload.signingOfficer || "").trim(),
    String(payload && payload.signingPosition || "").trim(),
    Number(result && result.personnelCount || personnel.length || 0),
    String(result && result.outputName || "").trim(),
    String(result && result.url || "").trim(),
    String(result && result.documentId || "").trim(),
    String(payload && payload.fileReference || "").trim(),
  ]);

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(lastRow, 1).setNumberFormat("MM/dd/yyyy hh:mm AM/PM");
  }
}

function getGeneratedReportSummaries(limit) {
  const sheet = getGeneratedReportsSheet_();
  const lastRow = sheet.getLastRow();
  const maxRows = Math.max(1, Math.min(Number(limit || 100), 500));

  if (lastRow < 2) {
    return { success: true, reports: [], total: 0 };
  }

  const rowCount = Math.min(lastRow - 1, maxRows);
  const startRow = lastRow - rowCount + 1;
  const values = sheet
    .getRange(startRow, 1, rowCount, GENERATED_REPORTS_CONFIG.headers.length)
    .getValues()
    .reverse();

  const timezone = Session.getScriptTimeZone();
  const reports = values.map((row, index) => ({
    id: String(row[9] || "") || `report-${startRow + rowCount - index - 1}`,
    generatedAt: formatGeneratedReportDate_(row[0], timezone, "MM/dd/yyyy hh:mm a"),
    reportType: String(row[1] || ""),
    orderNumber: String(row[2] || ""),
    orderDate: formatGeneratedReportDate_(row[3], timezone, "MM/dd/yyyy"),
    signingOfficer: String(row[4] || ""),
    signingPosition: String(row[5] || ""),
    personnelCount: Number(row[6] || 0),
    outputName: String(row[7] || ""),
    url: String(row[8] || ""),
    documentId: String(row[9] || ""),
    fileReference: String(row[10] || ""),
  }));

  return {
    success: true,
    reports,
    total: lastRow - 1,
  };
}

function getGeneratedReportsSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(
    GENERATED_REPORTS_CONFIG.sheetName
  );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(GENERATED_REPORTS_CONFIG.sheetName);
  }

  const headerRange = sheet.getRange(
    1,
    1,
    1,
    GENERATED_REPORTS_CONFIG.headers.length
  );
  const currentHeaders = headerRange.getDisplayValues()[0];

  if (
    currentHeaders.join("|") !==
    GENERATED_REPORTS_CONFIG.headers.join("|")
  ) {
    headerRange.setValues([GENERATED_REPORTS_CONFIG.headers]);
    headerRange
      .setFontWeight("bold")
      .setBackground("#1f6f34")
      .setFontColor("#ffffff");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, GENERATED_REPORTS_CONFIG.headers.length);
  }

  return sheet;
}

function formatGeneratedReportDate_(value, timezone, pattern) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, timezone, pattern);
  }
  return String(value);
}
