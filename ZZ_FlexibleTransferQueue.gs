//----------------------------------
// Flexible Transfer Queue override
//----------------------------------

function enqueueTransferBatch(payload, generatedReport) {
  try {
    const source = payload && typeof payload === "object" ? payload : {};
    const personnel = Array.isArray(source.personnel) ? source.personnel : [];
    if (!personnel.length) throw new Error("No personnel were supplied for the transfer queue.");

    const spreadsheet = SpreadsheetApp.openById(TRANSFER_QUEUE_CONFIG.spreadsheetId);
    const queueSheet = getOrCreateTransferQueueSheet_(spreadsheet);
    const personnelSheet = spreadsheet.getSheetByName(TRANSFER_QUEUE_CONFIG.personnelSheet);
    if (!personnelSheet) throw new Error("The LIST sheet was not found.");

    const personnelIndex = buildPersonnelIndex_(personnelSheet);
    const campByOffice = buildOfficeCampMap_(spreadsheet);
    const now = new Date();
    const documentUrl = String(generatedReport?.url || "").trim();

    const rows = personnel.map((person, index) => {
      const fullName = normalizePersonName_(person.fullName, person.rank);
      const previousOffice = cleanTransferValue_(person.fromOffice || person.from).toUpperCase();
      const previousCamp = cleanTransferValue_(person.fromCamp).toUpperCase();
      const mode = cleanTransferValue_(person.transferMode || "OFFICE_ONLY").toUpperCase();
      const newOffice = cleanTransferValue_(person.toOffice || (mode === "CAMP_ONLY" ? "" : person.to)).toUpperCase();
      let newCamp = cleanTransferValue_(person.toCamp).toUpperCase();

      const match = findPersonnelMatch_(personnelIndex, fullName, previousOffice);
      const livePreviousCamp = previousCamp || (match ? match.camp : "");
      if (!newCamp && newOffice) newCamp = campByOffice[newOffice] || "";
      if (mode === "OFFICE_ONLY" && !newCamp) newCamp = livePreviousCamp;
      if (mode === "CAMP_ONLY") {
        newCamp = newCamp || cleanTransferValue_(person.to).toUpperCase();
      }

      return [
        createTransferId_(source.orderNumber, index),
        cleanTransferValue_(source.orderNumber),
        cleanTransferValue_(source.orderDate),
        fullName,
        cleanTransferValue_(person.rank).toUpperCase(),
        previousOffice,
        livePreviousCamp,
        newOffice,
        newCamp,
        "PENDING",
        "",
        "",
        "",
        documentUrl,
        match ? mode : `Personnel was not uniquely matched in LIST. [${mode}]`,
        now,
      ];
    });

    queueSheet.getRange(queueSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    return { success: true, message: `${rows.length} transfer(s) added to the queue.`, count: rows.length };
  } catch (error) {
    return { success: false, message: error?.message || String(error) };
  }
}

function approveAndApplyTransfers(transferIds) {
  const ids = new Set((Array.isArray(transferIds) ? transferIds : [])
    .map(value => String(value || "").trim()).filter(Boolean));
  if (!ids.size) return { success: false, message: "Select at least one transfer." };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const spreadsheet = SpreadsheetApp.openById(TRANSFER_QUEUE_CONFIG.spreadsheetId);
    const queueSheet = getOrCreateTransferQueueSheet_(spreadsheet);
    const personnelSheet = spreadsheet.getSheetByName(TRANSFER_QUEUE_CONFIG.personnelSheet);
    if (!personnelSheet) throw new Error("The LIST sheet was not found.");

    const queueValues = queueSheet.getDataRange().getValues();
    const personnelIndex = buildPersonnelIndex_(personnelSheet);
    const approvedBy = Session.getActiveUser().getEmail() || "Personnel Filter user";
    const now = new Date();
    let applied = 0;
    const failures = [];

    for (let rowIndex = 1; rowIndex < queueValues.length; rowIndex++) {
      const row = queueValues[rowIndex];
      const transferId = String(row[0] || "").trim();
      if (!ids.has(transferId)) continue;
      const status = String(row[9] || "").toUpperCase();
      if (["APPLIED", "CANCELLED"].includes(status)) continue;

      const fullName = String(row[3] || "").trim();
      const previousOffice = String(row[5] || "").trim();
      const newOffice = String(row[7] || "").trim();
      const newCamp = String(row[8] || "").trim();
      const match = findPersonnelMatch_(personnelIndex, fullName, previousOffice);

      if (!match) {
        const message = "Personnel was not uniquely matched in LIST.";
        queueSheet.getRange(rowIndex + 1, 10).setValue("ERROR");
        queueSheet.getRange(rowIndex + 1, 15).setValue(message);
        failures.push(`${fullName}: ${message}`);
        continue;
      }

      const liveOffice = String(personnelSheet.getRange(match.rowNumber, 4).getDisplayValue() || "").trim();
      if (previousOffice && normalizeTransferKey_(liveOffice) !== normalizeTransferKey_(previousOffice)) {
        const message = `Current LIST office is ${liveOffice || "blank"}, not ${previousOffice}.`;
        queueSheet.getRange(rowIndex + 1, 10).setValue("ERROR");
        queueSheet.getRange(rowIndex + 1, 15).setValue(message);
        failures.push(`${fullName}: ${message}`);
        continue;
      }

      if (newOffice) personnelSheet.getRange(match.rowNumber, 4).setValue(newOffice);
      if (newCamp) personnelSheet.getRange(match.rowNumber, 6).setValue(newCamp);

      queueSheet.getRange(rowIndex + 1, 10, 1, 4).setValues([["APPLIED", approvedBy, now, now]]);
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
    return { success: false, message: error?.message || String(error) };
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}