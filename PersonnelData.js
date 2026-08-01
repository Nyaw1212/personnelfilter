//----------------------------------
// Personnel Web App Configuration
//----------------------------------

const PERSONNEL_WEB_CONFIG =
  Object.freeze({

    sheetName:
      "LIST",

    headerRow:
      1,

    firstDataRow:
      2,

  });

//----------------------------------
// Get Personnel Web App Data
//----------------------------------

function getPersonnelWebAppData() {

  const sheet =
    getPersonnelWebSheet_();

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  if (
    lastRow <
      PERSONNEL_WEB_CONFIG
        .firstDataRow ||
    lastColumn < 1
  ) {

    return {

      headers: [],

      records: [],

    };

  }

  //----------------------------------
  // Read Sheet
  //----------------------------------

  const values =
    sheet
      .getRange(
        PERSONNEL_WEB_CONFIG
          .headerRow,
        1,
        lastRow -
          PERSONNEL_WEB_CONFIG
            .headerRow +
          1,
        lastColumn
      )
      .getDisplayValues();

  const headers =
    values[0].map(
      value =>
        String(value).trim()
    );

  //----------------------------------
  // Build Personnel Records
  //----------------------------------

  const records =
    values
      .slice(1)
      .map(
        (
          row,
          index
        ) => {

          const source = {};

          headers.forEach(
            (
              header,
              columnIndex
            ) => {

              if (!header) {
                return;
              }

              source[header] =
                row[columnIndex];

            }
          );

          return normalizeWebPersonnelRecord_(
            source,
            index +
              PERSONNEL_WEB_CONFIG
                .firstDataRow,
            row
          );

        }
      )
      .filter(
        record =>
          Boolean(
            record["Full Name"] ||
            record.Rank ||
            record.Office ||
            record.Camp
          )
      );

  return {

    headers,

    records,

  };

}

//----------------------------------
// Get Personnel Sheet
//----------------------------------

function getPersonnelWebSheet_() {

  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(
        PERSONNEL_WEB_CONFIG
          .sheetName
      );

  if (!sheet) {

    throw new Error(
      `Sheet "${
        PERSONNEL_WEB_CONFIG
          .sheetName
      }" was not found.`
    );

  }

  return sheet;

}

//----------------------------------
// Normalize Personnel Record
//----------------------------------

function normalizeWebPersonnelRecord_(
  source,
  sheetRow,
  rawRow
) {

  const row = Array.isArray(rawRow) ? rawRow : [];

  // LIST sheet positional source of truth:
  // G = Rank, I = first name, J = middle/name extension, H = last name.
  // Full Name intentionally excludes column G so the UI can prepend Rank once.
  const columnG = cleanWebCellValue_(row[6]);
  const columnH = cleanWebCellValue_(row[7]);
  const columnI = cleanWebCellValue_(row[8]);
  const columnJ = cleanWebCellValue_(row[9]);

  const positionalFullName = [
    columnI,
    columnJ,
    columnH,
  ]
    .filter(Boolean)
    .join(" ");

  const positionalDisplayName = [
    columnG,
    columnI,
    columnJ,
    columnH,
  ]
    .filter(Boolean)
    .join(" ");

  const firstName =
    getWebRecordValue_(
      source,
      [
        "FIRST NAME",
        "First Name",
      ]
    );

  const middleName =
    getWebRecordValue_(
      source,
      [
        "MIDDLE NAME",
        "Middle Name",
      ]
    );

  const lastName =
    getWebRecordValue_(
      source,
      [
        "LAST NAME",
        "Last Name",
      ]
    );

  const suffix =
    getWebRecordValue_(
      source,
      [
        "SUFFIX",
        "Suffix",
      ]
    );

  const generatedName = [

    firstName,
    middleName,
    lastName,
    suffix,

  ]
    .filter(Boolean)
    .join(" ");

  const rank =
    columnG ||
    getWebRecordValue_(
      source,
      [
        "RANK",
        "Rank",
      ]
    );

  const fullName =
    positionalFullName ||
    generatedName ||
    getWebRecordValue_(
      source,
      [
        "FULL NAME",
        "Full Name",
      ]
    );

  return {

    __sheetRow:
      sheetRow,

    "Full Name":
      fullName,

    "Display Name":
      positionalDisplayName ||
      [rank, fullName].filter(Boolean).join(" "),

    "Rank":
      rank,

    "Gender":
      getWebRecordValue_(
        source,
        [
          "GENDER",
          "Gender",
        ]
      ),

    "Category":
      getWebRecordValue_(
        source,
        [
          "CATEGORY",
          "Category",
        ]
      ),

    "Type":
      getWebRecordValue_(
        source,
        [
          "TYPE",
          "Type",
        ]
      ),

    "Office":
      getWebRecordValue_(
        source,
        [
          "OFFICE",
          "Office",
        ]
      ),

    "Camp":
      getWebRecordValue_(
        source,
        [
          "CAMP",
          "Camp",
        ]
      ),

    "Status":
      getWebRecordValue_(
        source,
        [
          "STATUS",
          "Status",
        ]
      ),

  };

}

//----------------------------------
// Clean Raw Sheet Cell
//----------------------------------

function cleanWebCellValue_(value) {
  return String(value == null ? "" : value).trim();
}

//----------------------------------
// Get Record Value
//----------------------------------

function getWebRecordValue_(
  record,
  possibleHeaders
) {

  for (
    const header of
    possibleHeaders
  ) {

    if (
      Object.prototype
        .hasOwnProperty
        .call(
          record,
          header
        )
    ) {

      return String(
        record[header] ?? ""
      ).trim();

    }

  }

  return "";

}