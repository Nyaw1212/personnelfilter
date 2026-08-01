//----------------------------------
// OFFICE_DIRECTORY signatory service
//----------------------------------

const OFFICE_DIRECTORY_CONFIG = Object.freeze({
  spreadsheetId: "1-F2wKpEAVRMLNMDtrmvS5dT-MDP9YoNRaOVeQSKzwtg",
  sheetName: "OFFICE_DIRECTORY",
});

function getOfficeDirectoryForReport() {
  const spreadsheet = SpreadsheetApp.openById(
    OFFICE_DIRECTORY_CONFIG.spreadsheetId
  );
  const sheet = spreadsheet.getSheetByName(
    OFFICE_DIRECTORY_CONFIG.sheetName
  );

  if (!sheet) {
    return {
      success: false,
      message: "OFFICE_DIRECTORY sheet was not found.",
      records: [],
    };
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) {
    return { success: true, records: [] };
  }

  const headers = values[0].map(value =>
    String(value || "").trim().toUpperCase()
  );
  const index = Object.fromEntries(
    headers.map((header, position) => [header, position])
  );

  const valueAt = (row, header) => {
    const position = index[header];
    return Number.isInteger(position)
      ? String(row[position] || "").trim()
      : "";
  };

  const records = values.slice(1)
    .map(row => ({
      office: valueAt(row, "OFFICE"),
      officeCode: valueAt(row, "OFFICE CODE"),
      chiefName: valueAt(row, "CHIEF NAME"),
      chiefPosition: valueAt(row, "CHIEF POSITION"),
      deputyName: valueAt(row, "DEPUTY NAME"),
      deputyPosition: valueAt(row, "DEPUTY POSITION"),
      camp: valueAt(row, "CAMP"),
    }))
    .filter(record =>
      record.office || record.chiefName || record.deputyName
    );

  return { success: true, records };
}
