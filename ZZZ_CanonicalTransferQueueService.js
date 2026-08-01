//----------------------------------
// Canonical Transfer Queue Service
//----------------------------------

const CANONICAL_TRANSFER_QUEUE_CONFIG = Object.freeze({
  spreadsheetId: "1-F2wKpEAVRMLNMDtrmvS5dT-MDP9YoNRaOVeQSKzwtg",
  personnelSheet: "LIST",
  queueSheet: "TRANSFER_QUEUE",
});

const CANONICAL_TRANSFER_QUEUE_HEADERS = [
  "Transfer ID","Order Number","Order Date","Full Name","Rank",
  "Previous Office","Previous Camp","New Office","New Camp","Status",
  "Approved By","Approved Date","Applied Date","Document URL",
  "Error Message","Created Date"
];

function enqueueTransferBatchCanonical(payload, generatedReport) {
  try {
    const source = payload && typeof payload === "object" ? payload : {};
    const personnel = Array.isArray(source.personnel) ? source.personnel : [];
    if (!personnel.length) throw new Error("No personnel were supplied for the transfer queue.");

    const ss = SpreadsheetApp.openById(CANONICAL_TRANSFER_QUEUE_CONFIG.spreadsheetId);
    const queueSheet = getCanonicalTransferQueueSheet_(ss);
    const listSheet = ss.getSheetByName(CANONICAL_TRANSFER_QUEUE_CONFIG.personnelSheet);
    if (!listSheet) throw new Error("The LIST sheet was not found.");

    const index = buildCanonicalPersonnelIndex_(listSheet);
    const now = new Date();
    const documentUrl = String(generatedReport?.url || generatedReport?.documentUrl || "").trim();

    const rows = personnel.map((person, i) => {
      const fullName = canonicalNormalizeName_(person.fullName, person.rank);
      const previousOffice = canonicalClean_(person.fromOffice || person.from).toUpperCase();
      const previousCamp = canonicalClean_(person.fromCamp).toUpperCase();
      const newOffice = canonicalClean_(person.toOffice || person.to).toUpperCase();
      const newCamp = canonicalClean_(person.toCamp).toUpperCase();
      const match = canonicalFindMatch_(index, fullName, previousOffice);

      return [
        canonicalTransferId_(source.orderNumber, i),
        canonicalClean_(source.orderNumber),
        canonicalClean_(source.orderDate),
        fullName,
        canonicalClean_(person.rank).toUpperCase(),
        previousOffice,
        previousCamp || (match ? match.camp : ""),
        newOffice,
        newCamp,
        "PENDING","","","",documentUrl,
        match ? "" : "Personnel was not uniquely matched in LIST.",
        now
      ];
    });

    queueSheet.getRange(queueSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    SpreadsheetApp.flush();
    return { success: true, count: rows.length, message: `${rows.length} transfer(s) added to TRANSFER_QUEUE.` };
  } catch (error) {
    return { success: false, message: error?.message || String(error) };
  }
}

function getTransferQueueRecordsCanonical() {
  try {
    const ss = SpreadsheetApp.openById(CANONICAL_TRANSFER_QUEUE_CONFIG.spreadsheetId);
    const sheet = getCanonicalTransferQueueSheet_(ss);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, records: [], counts: canonicalEmptyStatusCounts_() };

    const values = sheet.getRange(2, 1, lastRow - 1, CANONICAL_TRANSFER_QUEUE_HEADERS.length).getDisplayValues();
    const records = values.map((row, i) => ({
      rowNumber: i + 2,
      transferId: row[0],
      orderNumber: row[1],
      orderDate: row[2],
      fullName: row[3],
      rank: row[4],
      previousOffice: row[5],
      previousCamp: row[6],
      newOffice: row[7],
      newCamp: row[8],
      status: canonicalDisplayStatus_(row[9]),
      approvedBy: row[10],
      approvedDate: row[11],
      appliedDate: row[12],
      documentUrl: row[13],
      errorMessage: row[14],
      createdDate: row[15]
    })).reverse();

    const counts = canonicalEmptyStatusCounts_();
    records.forEach(record => {
      counts.ALL++;
      if (Object.prototype.hasOwnProperty.call(counts, record.status)) counts[record.status]++;
    });

    return { success: true, records, counts };
  } catch (error) {
    return { success: false, records: [], counts: canonicalEmptyStatusCounts_(), message: error?.message || String(error) };
  }
}

function approveTransfersCanonical(transferIds) {
  const ids = canonicalIdSet_(transferIds);
  if (!ids.size) return { success: false, message: "Select at least one transfer." };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(CANONICAL_TRANSFER_QUEUE_CONFIG.spreadsheetId);
    const queueSheet = getCanonicalTransferQueueSheet_(ss);
    const queue = queueSheet.getDataRange().getValues();
    const approvedBy = Session.getActiveUser().getEmail() || "Personnel Filter user";
    const now = new Date();
    let approved = 0;
    let skipped = 0;

    for (let i = 1; i < queue.length; i++) {
      const row = queue[i];
      const id = String(row[0] || "").trim();
      if (!ids.has(id)) continue;
      const status = canonicalDisplayStatus_(row[9]);
      if (["APPLIED", "CANCELLED"].includes(status)) { skipped++; continue; }

      queueSheet.getRange(i + 1, 10, 1, 3).setValues([["APPROVED", approvedBy, now]]);
      queueSheet.getRange(i + 1, 15).clearContent();
      approved++;
    }

    SpreadsheetApp.flush();
    return {
      success: true,
      approved,
      skipped,
      message: `${approved} transfer(s) approved${skipped ? `; ${skipped} skipped` : ""}.`
    };
  } catch (error) {
    return { success: false, message: error?.message || String(error) };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function applyTransfersCanonical(transferIds) {
  return canonicalApplyTransfers_(transferIds, false);
}

function approveAndApplyTransfersCanonical(transferIds) {
  return canonicalApplyTransfers_(transferIds, true);
}

function cancelTransfersCanonical(transferIds) {
  const ids = canonicalIdSet_(transferIds);
  if (!ids.size) return { success: false, message: "Select at least one transfer." };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(CANONICAL_TRANSFER_QUEUE_CONFIG.spreadsheetId);
    const queueSheet = getCanonicalTransferQueueSheet_(ss);
    const queue = queueSheet.getDataRange().getValues();
    let cancelled = 0;
    let skipped = 0;

    for (let i = 1; i < queue.length; i++) {
      const row = queue[i];
      const id = String(row[0] || "").trim();
      if (!ids.has(id)) continue;
      const status = canonicalDisplayStatus_(row[9]);
      if (["APPLIED", "CANCELLED"].includes(status)) { skipped++; continue; }
      queueSheet.getRange(i + 1, 10).setValue("CANCELLED");
      cancelled++;
    }

    SpreadsheetApp.flush();
    return {
      success: true,
      cancelled,
      skipped,
      message: `${cancelled} transfer(s) cancelled${skipped ? `; ${skipped} skipped` : ""}.`
    };
  } catch (error) {
    return { success: false, message: error?.message || String(error) };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function canonicalApplyTransfers_(transferIds, approveFirst) {
  const ids = canonicalIdSet_(transferIds);
  if (!ids.size) return { success: false, message: "Select at least one transfer." };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(CANONICAL_TRANSFER_QUEUE_CONFIG.spreadsheetId);
    const queueSheet = getCanonicalTransferQueueSheet_(ss);
    const listSheet = ss.getSheetByName(CANONICAL_TRANSFER_QUEUE_CONFIG.personnelSheet);
    if (!listSheet) throw new Error("The LIST sheet was not found.");

    const queue = queueSheet.getDataRange().getValues();
    const index = buildCanonicalPersonnelIndex_(listSheet);
    const approvedBy = Session.getActiveUser().getEmail() || "Personnel Filter user";
    const now = new Date();
    let applied = 0;
    let skipped = 0;
    const failures = [];

    for (let i = 1; i < queue.length; i++) {
      const row = queue[i];
      const id = String(row[0] || "").trim();
      if (!ids.has(id)) continue;

      const status = canonicalDisplayStatus_(row[9]);
      if (["APPLIED", "CANCELLED"].includes(status)) { skipped++; continue; }
      if (!approveFirst && status !== "APPROVED") {
        failures.push(`${String(row[3] || "").trim()}: Transfer must be APPROVED before applying.`);
        continue;
      }

      const fullName = String(row[3] || "").trim();
      const previousOffice = String(row[5] || "").trim();
      const newOffice = String(row[7] || "").trim();
      const newCamp = String(row[8] || "").trim();
      const match = canonicalFindMatch_(index, fullName, previousOffice);

      if (!match) {
        canonicalMarkFailed_(queueSheet, i + 1, "Personnel was not uniquely matched in LIST.");
        failures.push(`${fullName}: Personnel was not uniquely matched in LIST.`);
        continue;
      }

      const liveOffice = String(listSheet.getRange(match.rowNumber, 4).getDisplayValue() || "").trim();
      if (previousOffice && canonicalKey_(liveOffice) !== canonicalKey_(previousOffice)) {
        const msg = `Current LIST office is ${liveOffice || "blank"}, not ${previousOffice}.`;
        canonicalMarkFailed_(queueSheet, i + 1, msg);
        failures.push(`${fullName}: ${msg}`);
        continue;
      }

      if (newOffice) listSheet.getRange(match.rowNumber, 4).setValue(newOffice);
      if (newCamp) listSheet.getRange(match.rowNumber, 6).setValue(newCamp);
      SpreadsheetApp.flush();

      const verifiedOffice = String(listSheet.getRange(match.rowNumber, 4).getDisplayValue() || "").trim();
      const verifiedCamp = String(listSheet.getRange(match.rowNumber, 6).getDisplayValue() || "").trim();
      const officeOk = !newOffice || canonicalKey_(verifiedOffice) === canonicalKey_(newOffice);
      const campOk = !newCamp || canonicalKey_(verifiedCamp) === canonicalKey_(newCamp);
      if (!officeOk || !campOk) {
        const msg = `LIST verification failed. Office=${verifiedOffice}; Camp=${verifiedCamp}.`;
        canonicalMarkFailed_(queueSheet, i + 1, msg);
        failures.push(`${fullName}: ${msg}`);
        continue;
      }

      const existingApprovedBy = String(row[10] || "").trim();
      const existingApprovedDate = row[11] || "";
      queueSheet.getRange(i + 1, 10, 1, 4).setValues([[
        "APPLIED",
        existingApprovedBy || approvedBy,
        existingApprovedDate || now,
        now
      ]]);
      queueSheet.getRange(i + 1, 15).clearContent();
      applied++;
    }

    SpreadsheetApp.flush();
    return {
      success: failures.length === 0,
      applied,
      skipped,
      failed: failures.length,
      failures,
      message: failures.length
        ? `${applied} transfer(s) applied; ${failures.length} failed${skipped ? `; ${skipped} skipped` : ""}.`
        : `${applied} transfer(s) applied to LIST${skipped ? `; ${skipped} skipped` : ""}.`
    };
  } catch (error) {
    return { success: false, message: error?.message || String(error) };
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function canonicalMarkFailed_(sheet, rowNumber, message) {
  sheet.getRange(rowNumber, 10).setValue("FAILED");
  sheet.getRange(rowNumber, 15).setValue(message);
}

function canonicalIdSet_(transferIds) {
  return new Set((Array.isArray(transferIds) ? transferIds : [])
    .map(value => String(value || "").trim())
    .filter(Boolean));
}

function canonicalDisplayStatus_(value) {
  const status = String(value || "PENDING").trim().toUpperCase();
  return status === "ERROR" ? "FAILED" : status;
}

function canonicalEmptyStatusCounts_() {
  return { ALL: 0, PENDING: 0, APPROVED: 0, APPLIED: 0, CANCELLED: 0, FAILED: 0 };
}

function getCanonicalTransferQueueSheet_(ss) {
  let sheet = ss.getSheetByName(CANONICAL_TRANSFER_QUEUE_CONFIG.queueSheet);
  if (!sheet) sheet = ss.insertSheet(CANONICAL_TRANSFER_QUEUE_CONFIG.queueSheet);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CANONICAL_TRANSFER_QUEUE_HEADERS.length).setValues([CANONICAL_TRANSFER_QUEUE_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function buildCanonicalPersonnelIndex_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  return values.slice(1).map((row, i) => ({
    rowNumber: i + 2,
    fullName: canonicalNormalizeName_(row[0], row[6]),
    office: String(row[3] || "").trim(),
    camp: String(row[5] || "").trim()
  }));
}

function canonicalFindMatch_(records, fullName, office) {
  const nameKey = canonicalKey_(fullName);
  const officeKey = canonicalKey_(office);
  let matches = records.filter(record => canonicalKey_(record.fullName) === nameKey);
  if (officeKey) {
    const officeMatches = matches.filter(record => canonicalKey_(record.office) === officeKey);
    if (officeMatches.length) matches = officeMatches;
  }
  return matches.length === 1 ? matches[0] : null;
}

function canonicalNormalizeName_(fullName, rank) {
  let name = canonicalClean_(fullName).toUpperCase();
  const cleanRank = canonicalClean_(rank).toUpperCase();
  if (cleanRank && name.indexOf(cleanRank + " ") === 0) name = name.slice(cleanRank.length).trim();
  return name.replace(/\s+/g, " ").trim();
}

function canonicalKey_(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function canonicalClean_(value) {
  return String(value == null ? "" : value).trim();
}

function canonicalTransferId_(orderNumber, index) {
  return [
    canonicalClean_(orderNumber) || "AO",
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss"),
    String(index + 1).padStart(3, "0"),
    Utilities.getUuid().slice(0, 8)
  ].join("-");
}
