//----------------------------------
// Canonical Transfer Queue name normalization
//----------------------------------
// Keeps TransferQ matching aligned with NameHandlerEngine canonical order:
// G (Rank) + I (First) + J (Middle) + H (Last) + K (Suffix).

function buildCanonicalPersonnelIndex_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];

  const headers = values[0].map(value =>
    String(value || "").trim().toUpperCase()
  );

  const column = aliases => {
    for (const alias of aliases) {
      const index = headers.indexOf(String(alias).toUpperCase());
      if (index >= 0) return index;
    }
    return -1;
  };

  const fullNameColumn = column(["FULL NAME"]);
  const rankColumn = column(["RANK"]);
  const firstNameColumn = column(["FIRST NAME"]);
  const middleNameColumn = column(["MIDDLE NAME"]);
  const lastNameColumn = column(["LAST NAME"]);
  const suffixColumn = column(["SUFFIX", "NAME EXTENSION"]);
  const officeColumn = column(["OFFICE"]);
  const campColumn = column(["CAMP"]);

  const valueAt = (row, index) =>
    index >= 0 ? String(row[index] || "").trim() : "";

  return values.slice(1).map((row, index) => {
    const rank = valueAt(row, rankColumn).toUpperCase();
    const structuredName = [
      valueAt(row, firstNameColumn),
      valueAt(row, middleNameColumn),
      valueAt(row, lastNameColumn),
      valueAt(row, suffixColumn),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();

    const legacyName = valueAt(row, fullNameColumn).toUpperCase();
    const fullName = structuredName || canonicalNormalizeName_(legacyName, rank);

    return {
      rowNumber: index + 2,
      fullName,
      canonicalName: fullName,
      rank,
      office: valueAt(row, officeColumn),
      camp: valueAt(row, campColumn),
    };
  });
}

function canonicalNormalizeName_(fullName, rank) {
  let name = canonicalClean_(fullName)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const cleanRank = canonicalClean_(rank)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  if (cleanRank && name.indexOf(cleanRank + " ") === 0) {
    name = name.slice(cleanRank.length).trim();
  }

  return name;
}
