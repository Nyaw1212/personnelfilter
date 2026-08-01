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

const PERSONNEL_NAME_SUFFIXES_ =
  new Set([
    "JR",
    "SR",
    "II",
    "III",
    "IV",
    "V",
  ]);

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

  // LIST positional source of truth:
  // A = canonical Full Name shown by the app.
  // G = Rank, H = Last Name, I = First Name, J = Middle Name / extension.
  // Structured fields remain available for sorting, but are not rebuilt for display.
  const columnA = cleanWebCellValue_(row[0]).toUpperCase();
  const columnG = cleanWebCellValue_(row[6]);
  const columnH = cleanWebCellValue_(row[7]);
  const columnI = cleanWebCellValue_(row[8]);
  const columnJ = cleanWebCellValue_(row[9]);

  const headerFirstName =
    getWebRecordValue_(
      source,
      [
        "FIRST NAME",
        "First Name",
      ]
    );

  const headerMiddleName =
    getWebRecordValue_(
      source,
      [
        "MIDDLE NAME",
        "Middle Name",
      ]
    );

  const headerLastName =
    getWebRecordValue_(
      source,
      [
        "LAST NAME",
        "Last Name",
      ]
    );

  const headerSuffix =
    getWebRecordValue_(
      source,
      [
        "SUFFIX",
        "Suffix",
        "NAME EXTENSION",
        "Name Extension",
      ]
    );

  const nameParts = normalizeWebNameParts_(
    columnI || headerFirstName,
    columnJ || headerMiddleName,
    columnH || headerLastName,
    headerSuffix
  );

  const rank = cleanWebCellValue_(
    columnG ||
    getWebRecordValue_(
      source,
      [
        "RANK",
        "Rank",
      ]
    )
  ).toUpperCase();

  const structuredFallbackName = [
    nameParts.first,
    nameParts.middle,
    nameParts.last,
    nameParts.suffix,
  ]
    .filter(Boolean)
    .join(" ");

  const fullName =
    columnA ||
    cleanWebCellValue_(
      getWebRecordValue_(
        source,
        [
          "FULL NAME",
          "Full Name",
        ]
      )
    ).toUpperCase() ||
    [rank, structuredFallbackName].filter(Boolean).join(" ");

  return {

    __sheetRow:
      sheetRow,

    "First Name":
      nameParts.first,

    "Middle Name":
      nameParts.middle,

    "Last Name":
      nameParts.last,

    "Suffix":
      nameParts.suffix,

    "Full Name":
      fullName,

    "Display Name":
      fullName,

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
// Normalize Structured Name Parts
//----------------------------------

function normalizeWebNameParts_(
  firstName,
  middleName,
  lastName,
  explicitSuffix
) {

  const parts = {
    first: cleanWebCellValue_(firstName),
    middle: cleanWebCellValue_(middleName),
    last: cleanWebCellValue_(lastName),
    suffix: normalizeWebSuffix_(explicitSuffix),
  };

  ["first", "middle", "last"].forEach(key => {
    const tokens = parts[key]
      .split(/\s+/)
      .filter(Boolean);

    const kept = [];

    tokens.forEach(token => {
      const normalizedSuffix = normalizeWebSuffix_(token);
      if (!parts.suffix && normalizedSuffix) {
        parts.suffix = normalizedSuffix;
      } else {
        kept.push(token);
      }
    });

    parts[key] = kept.join(" ");
  });

  Object.keys(parts).forEach(key => {
    parts[key] = cleanWebCellValue_(parts[key]).toUpperCase();
  });

  return parts;
}

//----------------------------------
// Normalize Suffix
//----------------------------------

function normalizeWebSuffix_(value) {
  const normalized = cleanWebCellValue_(value)
    .replace(/[.,]/g, "")
    .toUpperCase();

  return PERSONNEL_NAME_SUFFIXES_.has(normalized)
    ? normalized
    : "";
}

//----------------------------------
// Clean Raw Sheet Cell
//----------------------------------

function cleanWebCellValue_(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim();
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