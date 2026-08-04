//----------------------------------
// TransferQ transaction row index identity fix
//----------------------------------
// The batch engine builds a fresh row index for every transaction and
// discards it after the operation. Column R contains the canonical display
// name WITH rank, while TransferQ stores the personnel name without rank.
// This override safely removes a recognized leading rank before creating
// the temporary in-memory identity key.

const TRANSFERQ_RECOGNIZED_RANKS_ = new Set([
  "CCSUPT", "CTCSUPT", "CSSUPT", "CTSSUPT", "CSUPT", "CTSUPT",
  "CCINSP", "CTCINSP", "CSINSP", "CTSINSP", "CINSP", "CTINSP",
  "CSO4", "CTSO4", "CSO3", "CTSO3", "CSO2", "CTSO2",
  "CSO1", "CTSO1", "CO3", "CTO3", "CO2", "CTO2", "CO1", "CTO1"
]);

function canonicalNormalizeName_(fullName, rank) {
  let name = canonicalClean_(fullName)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  const suppliedRank = canonicalClean_(rank)
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

  if (suppliedRank && name.indexOf(suppliedRank + " ") === 0) {
    return name.slice(suppliedRank.length).trim();
  }

  // Column R is "CANONICAL NAME WITH RANK". During a transaction the batch
  // engine calls this function without supplying the rank, so detect only a
  // known rank token. Ordinary first names are never removed.
  const firstSpace = name.indexOf(" ");
  if (firstSpace > 0) {
    const leadingToken = name.slice(0, firstSpace);
    if (TRANSFERQ_RECOGNIZED_RANKS_.has(leadingToken)) {
      name = name.slice(firstSpace + 1).trim();
    }
  }

  return name;
}
