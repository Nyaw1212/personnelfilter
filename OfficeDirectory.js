//----------------------------------
// Office Signing Directory
//----------------------------------

const OFFICE_DIRECTORY_CONFIG = Object.freeze({
  sheetName: "OFFICE_DIRECTORY",
  headers: [
    "Office",
    "Office Code",
    "Chief Name",
    "Chief Position",
    "Deputy Name",
    "Deputy Position",
    "Camp",
  ],
});

/**
 * Returns office leadership records used by report-generation dialogs.
 * The data comes from the OFFICE_DIRECTORY tab of the Personnel Filter sheet.
 *
 * @return {{success:boolean, records:Array, message:string}}
 */
function getOfficeSigningDirectory() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(
      OFFICE_DIRECTORY_CONFIG.sheetName
    );

    if (!sheet) {
      return {
        success: true,
        records: [],
        message:
          'The OFFICE_DIRECTORY tab has not been created yet. Run setupOfficeDirectorySheet once.',
      };
    }

    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return {
        success: true,
        records: [],
        message: "The OFFICE_DIRECTORY tab is empty.",
      };
    }

    const values = sheet
      .getRange(2, 1, lastRow - 1, OFFICE_DIRECTORY_CONFIG.headers.length)
      .getDisplayValues();

    const records = values
      .map((row) => ({
        office: cleanOfficeDirectoryValue_(row[0]),
        officeCode: cleanOfficeDirectoryValue_(row[1]),
        chiefName: cleanOfficeDirectoryValue_(row[2]),
        chiefPosition: cleanOfficeDirectoryValue_(row[3]),
        deputyName: cleanOfficeDirectoryValue_(row[4]),
        deputyPosition: cleanOfficeDirectoryValue_(row[5]),
        camp: cleanOfficeDirectoryValue_(row[6]),
      }))
      .filter((record) => record.office)
      .sort((a, b) =>
        a.office.localeCompare(b.office, undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );

    return {
      success: true,
      records,
      message: `${records.length} office directory record(s) loaded.`,
    };
  } catch (error) {
    console.error("getOfficeSigningDirectory error:", error);

    return {
      success: false,
      records: [],
      message: getOfficeDirectoryErrorMessage_(error),
    };
  }
}

/**
 * Creates the OFFICE_DIRECTORY tab and its headers without overwriting
 * an existing directory. Run this once from the Apps Script editor.
 */
function setupOfficeDirectorySheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(
    OFFICE_DIRECTORY_CONFIG.sheetName
  );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      OFFICE_DIRECTORY_CONFIG.sheetName
    );
  }

  sheet
    .getRange(1, 1, 1, OFFICE_DIRECTORY_CONFIG.headers.length)
    .setValues([OFFICE_DIRECTORY_CONFIG.headers])
    .setFontWeight("bold");

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(
    1,
    OFFICE_DIRECTORY_CONFIG.headers.length
  );

  // Add the known default signer only when the directory has no data rows.
  if (sheet.getLastRow() < 2) {
    sheet.getRange(2, 1, 1, OFFICE_DIRECTORY_CONFIG.headers.length).setValues([
      [
        "OFFICE OF THE SUPERINTENDENT",
        "OTS",
        "CSSUPT GARY A GARCIA RCrim., MSCA",
        "Superintendent, New Bilibid Prison",
        "",
        "",
        "NBP",
      ],
    ]);
  }

  return {
    success: true,
    sheetName: OFFICE_DIRECTORY_CONFIG.sheetName,
    sheetUrl: spreadsheet.getUrl() + "#gid=" + sheet.getSheetId(),
  };
}

function cleanOfficeDirectoryValue_(value) {
  return String(
    value === null || value === undefined ? "" : value
  ).trim();
}

function getOfficeDirectoryErrorMessage_(error) {
  if (!error) return "Unknown office directory error.";
  return error.message || String(error);
}
