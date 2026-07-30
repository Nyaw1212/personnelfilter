//----------------------------------
// Transfer Queue Service
//----------------------------------

const TRANSFER_QUEUE_CONFIG = Object.freeze({
  spreadsheetId: "1-F2wKpEAVRMLNMDtrmvS5dT-MDP9YoNRaOVeQSKzwtg",
  personnelSheet: "LIST",
  officeDirectorySheet: "OFFICE_DIRECTORY",
  queueSheet: "TRANSFER_QUEUE",
});

const TRANSFER_QUEUE_HEADERS = [
  "Transfer ID",
  "Order Number",
  "Order Date",
  "Full Name",
  "Rank",
  "Previous Office",
  "Previous Camp",
  "New Office",
  "New Camp",
  "Status",
  "Approved By",
  "Approved Date",
  "Applied Date",
  "Document URL",
  "Error Message",
  "Created Date",
];

function enqueueTransferBatch(payload, generatedReport) {
  try {
    const source = payload && typeof payload === "object" ? payload : {};
    const personnel = Array.isArray(source.personnel) ? source.personnel : [];

    if (!personnel.length) {
      throw new Error("No personnel were supplied for the transfer queue.");
    }

    const spreadsheet = SpreadsheetApp.openById(
      TRANSFER_QUEUE_CONFIG.spreadsheetId
    );
    const queueSheet = getOrCreateTransferQueueSheet_(spreadsheet);
    const personnelSheet = spreadsheet.getSheetByName(
      TRANSFER_QUEUE_CONFIG.personnelSheet
    );

    if (!personnelSheet) {
      throw new Error("The LIST sheet was not found.");
    }

    const personnelIndex = buildPersonnelIndex_(personnelSheet);
    const campByOffice = buildOfficeCampMap_(spreadsheet);
    const now = new Date();
    const documentUrl = String(generatedReport?.url || "").trim();

    const rows = personnel.map((person, index) => {
      const fullName = normalizePersonName_(person.fullName, person.rank);
      const currentOffice = cleanTransferValue_(person.from).toUpperCase();
      const destinationOffice = cleanTransferValue_(person.to).toUpperCase();
      const match = findPersonnelMatch_(
        personnelIndex,
        fullName,
        currentOffice
      );

      const previousCamp = match ? match.camp : "";
      const destinationCamp = campByOffice[destinationOffice] || previousCamp;

      return [
        createTransferId_(source.orderNumber, index),
        cleanTransferValue_(source.orderNumber),
        cleanTransferValue_(source.orderDate),
        fullName,
        cleanTransferValue_(person.rank).toUpperCase(),
        currentOffice,
        previousCamp,
        destinationOffice,
        destinationCamp,
        "PENDING",
        "",
        "",
        "",
        documentUrl,
        match ? "" : "Personnel was not uniquely matched in LIST.",
        now,
      ];
    });

    queueSheet
      .getRange(queueSheet.getLastRow() + 1, 1, rows.length, rows[0].length)
      .setValues(rows);

    return {
      success: true,
      message: `${rows.length} transfer(s) added to the queue.`,
      count: rows.length,
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || String(error),
    };
  }
}

function getTransferQueueRecords() {
  try {
    const spreadsheet = SpreadsheetApp.openById(
      TRANSFER_QUEUE_CONFIG.spreadsheetId
    );
    const sheet = getOrCreateTransferQueueSheet_(spreadsheet);
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return { success: true, records: [] };
    }

    const values = sheet
      .getRange(2, 1, lastRow - 1, TRANSFER_QUEUE_HEADERS.length)
      .getDisplayValues();

    const records = values
      .map((row, index) => ({
        rowNumber: index + 2,
        transferId: row[0],
        orderNumber: row[1],
        orderDate: row[2],
        fullName: row[3],
        rank: row[4],
        previousOffice: row[5],
        previousCamp: row[6],
        newOffice: row[7],
        newCamp: row[8],
        status: row[9],
        approvedBy: row[10],
        approvedDate: row[11],
        appliedDate: row[12],
        documentUrl: row[13],
        errorMessage: row[14],
        createdDate: row[15],
      }))
      .reverse();

    return { success: true, records };
  } catch (error) {
    return {
      success: false,
      message: error?.message || String(error),
      records: [],
    };
  }
}

function approveAndApplyTransfers(transferIds) {
  const ids = new Set(
    (Array.isArray(transferIds) ? transferIds : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  );

  if (!ids.size) {
    return { success: false, message: "Select at least one transfer." };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const spreadsheet = SpreadsheetApp.openById(
      TRANSFER_QUEUE_CONFIG.spreadsheetId
    );
    const queueSheet = getOrCreateTransferQueueSheet_(spreadsheet);
    const personnelSheet = spreadsheet.getSheetByName(
      TRANSFER_QUEUE_CONFIG.personnelSheet
    );

    if (!personnelSheet) {
      throw new Error("The LIST sheet was not found.");
    }

    const queueValues = queueSheet.getDataRange().getValues();
    const personnelIndex = buildPersonnelIndex_(personnelSheet);
    const approvedBy =
      Session.getActiveUser().getEmail() || "Personnel Filter user";
    const now = new Date();
    let applied = 0;
    const failures = [];

    for (let rowIndex = 1; rowIndex < queueValues.length; rowIndex++) {
      const row = queueValues[rowIndex];
      const transferId = String(row[0] || "").trim();

      if (!ids.has(transferId)) continue;

      const status = String(row[9] || "").toUpperCase();
      if (status === "APPLIED") continue;

      const fullName = String(row[3] || "").trim();
      const previousOffice = String(row[5] || "").trim();
      const newOffice = String(row[7] || "").trim();
      const newCamp = String(row[8] || "").trim();
      const match = findPersonnelMatch_(
        personnelIndex,
        fullName,
        previousOffice
      );

      if (!match) {
        const message = "Personnel was not uniquely matched in LIST.";
        queueSheet.getRange(rowIndex + 1, 10).setValue("ERROR");
        queueSheet.getRange(rowIndex + 1, 15).setValue(message);
        failures.push(`${fullName}: ${message}`);
        continue;
      }

      const liveOffice = String(
        personnelSheet.getRange(match.rowNumber, 4).getDisplayValue() || ""
      ).trim();

      if (
        previousOffice &&
        normalizeTransferKey_(liveOffice) !== normalizeTransferKey_(previousOffice)
      ) {
        const message = `Current LIST office is ${liveOffice || "blank"}, not ${previousOffice}.`;
        queueSheet.getRange(rowIndex + 1, 10).setValue("ERROR");
        queueSheet.getRange(rowIndex + 1, 15).setValue(message);
        failures.push(`${fullName}: ${message}`);
        continue;
      }

      personnelSheet.getRange(match.rowNumber, 4).setValue(newOffice);
      personnelSheet.getRange(match.rowNumber, 6).setValue(newCamp);

      queueSheet.getRange(rowIndex + 1, 10, 1, 4).setValues([[
        "APPLIED",
        approvedBy,
        now,
        now,
      ]]);
      queueSheet.getRange(rowIndex + 1, 15).clearContent();
      applied++;
    }

    return {
      success: failures.length === 0,
      applied,
      failed: failures.length,
      failures,
      message: failures.length
        ? `${applied} transfer(s) applied; ${failures.length} failed.`
        : `${applied} transfer(s) approved and applied to LIST.`,
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || String(error),
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (ignored) {}
  }
}

function getOrCreateTransferQueueSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(
    TRANSFER_QUEUE_CONFIG.queueSheet
  );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      TRANSFER_QUEUE_CONFIG.queueSheet
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, TRANSFER_QUEUE_HEADERS.length)
      .setValues([TRANSFER_QUEUE_HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function buildPersonnelIndex_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  const records = [];

  for (let index = 1; index < values.length; index++) {
    const row = values[index];
    records.push({
      rowNumber: index + 1,
      fullName: normalizePersonName_(row[0], row[6]),
      office: String(row[3] || "").trim(),
      camp: String(row[5] || "").trim(),
    });
  }

  return records;
}

function findPersonnelMatch_(records, fullName, office) {
  const nameKey = normalizeTransferKey_(fullName);
  const officeKey = normalizeTransferKey_(office);
  let matches = records.filter(record =>
    normalizeTransferKey_(record.fullName) === nameKey
  );

  if (officeKey) {
    const officeMatches = matches.filter(record =>
      normalizeTransferKey_(record.office) === officeKey
    );
    if (officeMatches.length) matches = officeMatches;
  }

  return matches.length === 1 ? matches[0] : null;
}

function buildOfficeCampMap_(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(
    TRANSFER_QUEUE_CONFIG.officeDirectorySheet
  );
  if (!sheet || sheet.getLastRow() < 2) return {};

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map(value => normalizeTransferKey_(value));
  const officeIndex = headers.findIndex(value =>
    ["OFFICE", "OFFICENAME", "OFFICECODE"].includes(value)
  );
  const campIndex = headers.findIndex(value => value === "CAMP");
  const map = {};

  if (officeIndex < 0 || campIndex < 0) return map;

  values.slice(1).forEach(row => {
    const office = String(row[officeIndex] || "").trim().toUpperCase();
    const camp = String(row[campIndex] || "").trim().toUpperCase();
    if (office) map[office] = camp;
  });

  return map;
}

function normalizePersonName_(fullName, rank) {
  let name = cleanTransferValue_(fullName).toUpperCase();
  const cleanRank = cleanTransferValue_(rank).toUpperCase();
  if (cleanRank && name.indexOf(cleanRank + " ") === 0) {
    name = name.slice(cleanRank.length).trim();
  }
  return name.replace(/\s+/g, " ").trim();
}

function normalizeTransferKey_(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function cleanTransferValue_(value) {
  return String(value === null || value === undefined ? "" : value).trim();
}

function createTransferId_(orderNumber, index) {
  return [
    cleanTransferValue_(orderNumber) || "AO",
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMddHHmmss"),
    String(index + 1).padStart(3, "0"),
    Utilities.getUuid().slice(0, 8),
  ].join("-");
}
