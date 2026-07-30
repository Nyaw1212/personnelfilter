//----------------------------------
// Personnel Performance Server
//----------------------------------

const PERSONNEL_PERFORMANCE_CACHE = Object.freeze({
  ttlSeconds: 300,
  chunkSize: 80000,
  prefix: "personnelWebDataV2",
});

function getPersonnelWebAppDataOptimized() {
  const sheet = getPersonnelWebSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const version = `${lastRow}:${lastColumn}`;
  const cached = readPersonnelPerformanceCache_(version);

  if (cached) {
    return cached;
  }

  if (lastRow < 2 || lastColumn < 1) {
    return { headers: [], records: [], cached: false };
  }

  const rawHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(value => String(value || "").trim());

  const headerMap = new Map();
  rawHeaders.forEach((header, index) => {
    const normalized = header.toUpperCase();
    if (normalized && !headerMap.has(normalized)) {
      headerMap.set(normalized, index + 1);
    }
  });

  const fields = [
    { key: "Full Name", aliases: ["FULL NAME"] },
    { key: "FIRST NAME", aliases: ["FIRST NAME"] },
    { key: "MIDDLE NAME", aliases: ["MIDDLE NAME"] },
    { key: "LAST NAME", aliases: ["LAST NAME"] },
    { key: "SUFFIX", aliases: ["SUFFIX"] },
    { key: "Rank", aliases: ["RANK"] },
    { key: "Gender", aliases: ["GENDER"] },
    { key: "Category", aliases: ["CATEGORY"] },
    { key: "Type", aliases: ["TYPE"] },
    { key: "Office", aliases: ["OFFICE"] },
    { key: "Camp", aliases: ["CAMP"] },
    { key: "Status", aliases: ["STATUS"] },
  ];

  const resolvedFields = fields
    .map(field => {
      const column = field.aliases
        .map(alias => headerMap.get(alias))
        .find(Number.isInteger);
      return { ...field, column };
    })
    .filter(field => Number.isInteger(field.column));

  const rowCount = lastRow - 1;
  const ranges = resolvedFields.map(field =>
    `${columnToA1_(field.column)}2:${columnToA1_(field.column)}${lastRow}`
  );

  const columns = ranges.length
    ? sheet.getRangeList(ranges).getRanges().map(range =>
        range.getDisplayValues().map(row => row[0])
      )
    : [];

  const records = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const source = {};

    resolvedFields.forEach((field, fieldIndex) => {
      source[field.key] = String(columns[fieldIndex][rowIndex] || "").trim();
    });

    const fullName = source["Full Name"] || [
      source["FIRST NAME"],
      source["MIDDLE NAME"],
      source["LAST NAME"],
      source["SUFFIX"],
    ].filter(Boolean).join(" ");

    const record = {
      __sheetRow: rowIndex + 2,
      "Full Name": fullName,
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

  const result = {
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
  };

  writePersonnelPerformanceCache_(version, result);
  return result;
}

function clearPersonnelPerformanceCache() {
  const cache = CacheService.getScriptCache();
  const meta = cache.get(`${PERSONNEL_PERFORMANCE_CACHE.prefix}:meta`);
  if (meta) {
    try {
      const parsed = JSON.parse(meta);
      const keys = Array.from(
        { length: Number(parsed.chunks || 0) },
        (_, index) => `${PERSONNEL_PERFORMANCE_CACHE.prefix}:${parsed.version}:${index}`
      );
      if (keys.length) cache.removeAll(keys);
    } catch (error) {
      console.warn("Unable to clear personnel cache chunks:", error);
    }
  }
  cache.remove(`${PERSONNEL_PERFORMANCE_CACHE.prefix}:meta`);
  return { success: true };
}

function readPersonnelPerformanceCache_(version) {
  const cache = CacheService.getScriptCache();
  const metaText = cache.get(`${PERSONNEL_PERFORMANCE_CACHE.prefix}:meta`);
  if (!metaText) return null;

  try {
    const meta = JSON.parse(metaText);
    if (meta.version !== version || !meta.chunks) return null;

    const keys = Array.from(
      { length: meta.chunks },
      (_, index) => `${PERSONNEL_PERFORMANCE_CACHE.prefix}:${version}:${index}`
    );
    const chunks = cache.getAll(keys);
    const text = keys.map(key => chunks[key] || "").join("");
    if (!text) return null;

    const result = JSON.parse(text);
    result.cached = true;
    return result;
  } catch (error) {
    console.warn("Unable to read personnel cache:", error);
    return null;
  }
}

function writePersonnelPerformanceCache_(version, value) {
  try {
    const cache = CacheService.getScriptCache();
    const text = JSON.stringify(value);
    const chunks = [];

    for (let index = 0; index < text.length; index += PERSONNEL_PERFORMANCE_CACHE.chunkSize) {
      chunks.push(text.slice(index, index + PERSONNEL_PERFORMANCE_CACHE.chunkSize));
    }

    const entries = {};
    chunks.forEach((chunk, index) => {
      entries[`${PERSONNEL_PERFORMANCE_CACHE.prefix}:${version}:${index}`] = chunk;
    });

    cache.putAll(entries, PERSONNEL_PERFORMANCE_CACHE.ttlSeconds);
    cache.put(
      `${PERSONNEL_PERFORMANCE_CACHE.prefix}:meta`,
      JSON.stringify({ version, chunks: chunks.length }),
      PERSONNEL_PERFORMANCE_CACHE.ttlSeconds
    );
  } catch (error) {
    console.warn("Unable to write personnel cache:", error);
  }
}

function columnToA1_(column) {
  let value = Number(column);
  let result = "";
  while (value > 0) {
    value--;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}
