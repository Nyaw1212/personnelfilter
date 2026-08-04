//----------------------------------
// Personnel Table V2 Server
//----------------------------------
// Always reads the current LIST sheet directly.
// Returns both the legacy Full Name and the structured LIST name fields so
// the client NameHandlerEngine can produce one canonical identity.

function getPersonnelTableV2Data() {
  const sheet = getPersonnelWebSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return {
      headers: [],
      records: [],
      cached: false,
      source: "direct-sheet-read",
      loadedAt: new Date().toISOString(),
    };
  }

  const values = sheet
    .getRange(1, 1, lastRow, lastColumn)
    .getDisplayValues();

  const rawHeaders = values[0].map(value =>
    String(value || "").trim()
  );

  const headerMap = new Map();
  rawHeaders.forEach((header, index) => {
    const normalized = header.toUpperCase();
    if (normalized && !headerMap.has(normalized)) {
      headerMap.set(normalized, index);
    }
  });

  const fields = [
    { key: "Full Name", aliases: ["FULL NAME"] },
    { key: "FIRST NAME", aliases: ["FIRST NAME"] },
    { key: "MIDDLE NAME", aliases: ["MIDDLE NAME"] },
    { key: "LAST NAME", aliases: ["LAST NAME"] },
    { key: "SUFFIX", aliases: ["SUFFIX", "NAME EXTENSION"] },
    { key: "Rank", aliases: ["RANK"] },
    { key: "Gender", aliases: ["GENDER"] },
    { key: "Category", aliases: ["CATEGORY"] },
    { key: "Type", aliases: ["TYPE"] },
    { key: "Office", aliases: ["OFFICE"] },
    { key: "Camp", aliases: ["CAMP"] },
    { key: "Status", aliases: ["STATUS"] },
  ];

  const resolvedFields = fields.map(field => {
    const columnIndex = field.aliases
      .map(alias => headerMap.get(alias))
      .find(Number.isInteger);

    return {
      ...field,
      columnIndex,
    };
  });

  const records = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const source = {};

    resolvedFields.forEach(field => {
      source[field.key] = Number.isInteger(field.columnIndex)
        ? String(row[field.columnIndex] || "").trim()
        : "";
    });

    const structuredName = [
      source["FIRST NAME"],
      source["MIDDLE NAME"],
      source["LAST NAME"],
      source["SUFFIX"],
    ].filter(Boolean).join(" ");

    const fullName = source["Full Name"] || structuredName;

    const record = {
      __sheetRow: rowIndex + 1,
      "Full Name": fullName,
      "FIRST NAME": source["FIRST NAME"],
      "MIDDLE NAME": source["MIDDLE NAME"],
      "LAST NAME": source["LAST NAME"],
      "SUFFIX": source["SUFFIX"],
      Rank: source.Rank || "",
      Gender: source.Gender || "",
      Category: source.Category || "",
      Type: source.Type || "",
      Office: source.Office || "",
      Camp: source.Camp || "",
      Status: source.Status || "",
    };

    if (record["Full Name"] || record.Rank || record.Office || record.Camp) {
      records.push(record);
    }
  }

  return {
    headers: [
      "Full Name",
      "Rank",
      "Gender",
      "Category",
      "Type",
      "Office",
      "Camp",
      "Status",
    ],
    records,
    cached: false,
    source: "direct-sheet-read",
    loadedAt: new Date().toISOString(),
    sheetName: sheet.getName(),
    lastRow,
    lastColumn,
  };
}
