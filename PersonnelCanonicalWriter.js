//----------------------------------
// Personnel Canonical Field Writer
//----------------------------------
// Rebuilds stable canonical identity columns in LIST without overwriting
// the original human-entered name fields.

const PERSONNEL_CANONICAL_WRITER_CONFIG = Object.freeze({
  outputHeaders: [
    "CANONICAL NAME",
    "CANONICAL NAME WITH RANK",
    "PERSONNEL SEARCH KEY",
    "NAME ENGINE VERSION"
  ],
  engineVersion: "2.0.0",
  sourceAliases: Object.freeze({
    fullName: ["FULL NAME"],
    rank: ["RANK"],
    firstName: ["FIRST NAME"],
    middleName: ["MIDDLE NAME"],
    lastName: ["LAST NAME"],
    suffix: ["SUFFIX", "NAME EXTENSION"]
  })
});

function rebuildPersonnelCanonicalFields() {
  const startedAt = Date.now();
  const sheet = getPersonnelWebSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return {
      success: true,
      updated: 0,
      skipped: 0,
      message: "No personnel rows were available to normalize."
    };
  }

  const values = sheet
    .getRange(1, 1, lastRow, lastColumn)
    .getDisplayValues();

  const headers = values[0].map(value =>
    String(value || "").trim()
  );

  const headerMap = canonicalWriterHeaderMap_(headers);
  const sourceColumns = canonicalWriterResolveSourceColumns_(headerMap);
  const outputColumns = canonicalWriterEnsureOutputColumns_(
    sheet,
    headers,
    headerMap
  );

  const output = [];
  let updated = 0;
  let skipped = 0;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const parts = canonicalWriterReadParts_(row, sourceColumns);
    const canonicalName = canonicalWriterName_(parts, false);
    const canonicalNameWithRank = canonicalWriterName_(parts, true);

    if (!canonicalName && !canonicalNameWithRank) {
      output.push(["", "", "", PERSONNEL_CANONICAL_WRITER_CONFIG.engineVersion]);
      skipped++;
      continue;
    }

    output.push([
      canonicalName,
      canonicalNameWithRank,
      canonicalWriterSearchKey_(canonicalNameWithRank || canonicalName),
      PERSONNEL_CANONICAL_WRITER_CONFIG.engineVersion
    ]);
    updated++;
  }

  PERSONNEL_CANONICAL_WRITER_CONFIG.outputHeaders.forEach((header, index) => {
    sheet
      .getRange(2, outputColumns[header], output.length, 1)
      .setValues(output.map(row => [row[index]]));
  });

  SpreadsheetApp.flush();

  const result = {
    success: true,
    sheetName: sheet.getName(),
    updated,
    skipped,
    totalRows: output.length,
    engineVersion: PERSONNEL_CANONICAL_WRITER_CONFIG.engineVersion,
    outputColumns,
    totalMs: Date.now() - startedAt,
    message: `${updated} personnel row(s) normalized; ${skipped} blank row(s) skipped.`
  };

  console.log(
    "[PersonnelCanonicalWriter] total=%sms updated=%s skipped=%s columns=%s",
    result.totalMs,
    result.updated,
    result.skipped,
    JSON.stringify(result.outputColumns)
  );

  return result;
}

function previewPersonnelCanonicalFields(limit) {
  const sheet = getPersonnelWebSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const maxRows = Math.max(1, Math.min(Number(limit || 10), 100));

  if (lastRow < 2 || lastColumn < 1) {
    return { success: true, rows: [] };
  }

  const rowCount = Math.min(lastRow - 1, maxRows);
  const values = sheet
    .getRange(1, 1, rowCount + 1, lastColumn)
    .getDisplayValues();

  const headers = values[0].map(value => String(value || "").trim());
  const headerMap = canonicalWriterHeaderMap_(headers);
  const sourceColumns = canonicalWriterResolveSourceColumns_(headerMap);

  const rows = values.slice(1).map((row, index) => {
    const parts = canonicalWriterReadParts_(row, sourceColumns);
    const canonicalName = canonicalWriterName_(parts, false);
    const canonicalNameWithRank = canonicalWriterName_(parts, true);

    return {
      rowNumber: index + 2,
      rawFullName: parts.rawFullName,
      rank: parts.rank,
      canonicalName,
      canonicalNameWithRank,
      searchKey: canonicalWriterSearchKey_(canonicalNameWithRank || canonicalName)
    };
  });

  console.log(JSON.stringify(rows, null, 2));
  return { success: true, rows };
}

function canonicalWriterHeaderMap_(headers) {
  const map = new Map();

  headers.forEach((header, index) => {
    const key = String(header || "").trim().toUpperCase();
    if (key && !map.has(key)) map.set(key, index + 1);
  });

  return map;
}

function canonicalWriterResolveSourceColumns_(headerMap) {
  const resolve = aliases => {
    for (const alias of aliases) {
      const column = headerMap.get(String(alias).toUpperCase());
      if (Number.isInteger(column)) return column - 1;
    }
    return -1;
  };

  const aliases = PERSONNEL_CANONICAL_WRITER_CONFIG.sourceAliases;

  return {
    fullName: resolve(aliases.fullName),
    rank: resolve(aliases.rank),
    firstName: resolve(aliases.firstName),
    middleName: resolve(aliases.middleName),
    lastName: resolve(aliases.lastName),
    suffix: resolve(aliases.suffix)
  };
}

function canonicalWriterEnsureOutputColumns_(sheet, headers, headerMap) {
  const result = {};
  let nextColumn = headers.length + 1;

  PERSONNEL_CANONICAL_WRITER_CONFIG.outputHeaders.forEach(header => {
    const existing = headerMap.get(header.toUpperCase());

    if (Number.isInteger(existing)) {
      result[header] = existing;
      return;
    }

    sheet.getRange(1, nextColumn).setValue(header);
    result[header] = nextColumn;
    nextColumn++;
  });

  const firstOutputColumn = Math.min.apply(null, Object.values(result));
  sheet
    .getRange(1, firstOutputColumn, 1, PERSONNEL_CANONICAL_WRITER_CONFIG.outputHeaders.length)
    .setFontWeight("bold")
    .setBackground("#1f6f34")
    .setFontColor("#ffffff");

  return result;
}

function canonicalWriterReadParts_(row, columns) {
  const valueAt = index =>
    index >= 0 ? String(row[index] || "").replace(/\s+/g, " ").trim() : "";

  return {
    rawFullName: valueAt(columns.fullName).toUpperCase(),
    rank: valueAt(columns.rank).toUpperCase(),
    firstName: valueAt(columns.firstName).toUpperCase(),
    middleName: valueAt(columns.middleName).toUpperCase(),
    lastName: valueAt(columns.lastName).toUpperCase(),
    suffix: valueAt(columns.suffix).replace(/[.,]/g, "").toUpperCase()
  };
}

function canonicalWriterName_(parts, includeRank) {
  const structured = [
    parts.firstName,
    parts.middleName,
    parts.lastName,
    parts.suffix
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  let name = structured || parts.rawFullName;

  if (parts.rank && name.indexOf(parts.rank + " ") === 0) {
    name = name.slice(parts.rank.length).trim();
  }

  return [includeRank ? parts.rank : "", name]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalWriterSearchKey_(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
