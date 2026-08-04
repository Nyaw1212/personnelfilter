//----------------------------------
// Transfer Queue warning-only verification
//----------------------------------
// Previous-office mismatches are advisory. A uniquely matched personnel
// record may still be applied, while the discrepancy is returned and stored
// as a warning for review.

function canonicalApplyTransfers_(transferIds, approveFirst) {
  const ids = canonicalIdSet_(transferIds);
  if (!ids.size) {
    return { success: false, message: "Select at least one transfer." };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.openById(
      CANONICAL_TRANSFER_QUEUE_CONFIG.spreadsheetId
    );
    const queueSheet = getCanonicalTransferQueueSheet_(ss);
    const listSheet = ss.getSheetByName(
      CANONICAL_TRANSFER_QUEUE_CONFIG.personnelSheet
    );

    if (!listSheet) throw new Error("The LIST sheet was not found.");

    const queue = queueSheet.getDataRange().getValues();
    const index = buildCanonicalPersonnelIndex_(listSheet);
    const approvedBy =
      Session.getActiveUser().getEmail() || "Personnel Filter user";
    const now = new Date();

    let applied = 0;
    let skipped = 0;
    const failures = [];
    const warnings = [];

    for (let i = 1; i < queue.length; i++) {
      const row = queue[i];
      const id = String(row[0] || "").trim();
      if (!ids.has(id)) continue;

      const status = canonicalDisplayStatus_(row[9]);
      if (["APPLIED", "CANCELLED"].includes(status)) {
        skipped++;
        continue;
      }

      if (!approveFirst && status !== "APPROVED") {
        failures.push(
          `${String(row[3] || "").trim()}: Transfer must be APPROVED before applying.`
        );
        continue;
      }

      const fullName = String(row[3] || "").trim();
      const previousOffice = String(row[5] || "").trim();
      const newOffice = String(row[7] || "").trim();
      const newCamp = String(row[8] || "").trim();
      const match = canonicalFindMatch_(index, fullName, previousOffice);

      if (!match) {
        const message = "Personnel was not uniquely matched in LIST.";
        canonicalMarkFailed_(queueSheet, i + 1, message);
        failures.push(`${fullName}: ${message}`);
        continue;
      }

      const liveOffice = String(
        listSheet.getRange(match.rowNumber, 4).getDisplayValue() || ""
      ).trim();

      const liveOfficeKey = canonicalKey_(liveOffice);
      const previousOfficeKey = canonicalKey_(previousOffice);
      let rowWarning = "";

      if (
        previousOfficeKey &&
        liveOfficeKey !== previousOfficeKey
      ) {
        rowWarning = liveOfficeKey
          ? `WARNING: Current LIST office is ${liveOffice}, not ${previousOffice}. Transfer applied after advisory review.`
          : `WARNING: Current LIST office is blank; previous office ${previousOffice} could not be verified. Transfer applied.`;

        warnings.push(`${fullName}: ${rowWarning}`);
        console.warn("[TransferQ][Warning] %s", `${fullName}: ${rowWarning}`);
      }

      if (newOffice) {
        listSheet.getRange(match.rowNumber, 4).setValue(newOffice);
      }
      if (newCamp) {
        listSheet.getRange(match.rowNumber, 6).setValue(newCamp);
      }

      SpreadsheetApp.flush();

      const verifiedOffice = String(
        listSheet.getRange(match.rowNumber, 4).getDisplayValue() || ""
      ).trim();
      const verifiedCamp = String(
        listSheet.getRange(match.rowNumber, 6).getDisplayValue() || ""
      ).trim();
      const officeOk =
        !newOffice || canonicalKey_(verifiedOffice) === canonicalKey_(newOffice);
      const campOk =
        !newCamp || canonicalKey_(verifiedCamp) === canonicalKey_(newCamp);

      if (!officeOk || !campOk) {
        const message =
          `LIST verification failed. Office=${verifiedOffice}; Camp=${verifiedCamp}.`;
        canonicalMarkFailed_(queueSheet, i + 1, message);
        failures.push(`${fullName}: ${message}`);
        continue;
      }

      const existingApprovedBy = String(row[10] || "").trim();
      const existingApprovedDate = row[11] || "";

      queueSheet.getRange(i + 1, 10, 1, 4).setValues([[
        "APPLIED",
        existingApprovedBy || approvedBy,
        existingApprovedDate || now,
        now,
      ]]);

      if (rowWarning) {
        queueSheet.getRange(i + 1, 15).setValue(rowWarning);
      } else {
        queueSheet.getRange(i + 1, 15).clearContent();
      }

      applied++;
    }

    SpreadsheetApp.flush();

    const warningSuffix = warnings.length
      ? `; ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
      : "";

    return {
      success: failures.length === 0,
      applied,
      skipped,
      failed: failures.length,
      failures,
      warningCount: warnings.length,
      warnings,
      message: failures.length
        ? `${applied} transfer(s) applied; ${failures.length} failed${warningSuffix}${skipped ? `; ${skipped} skipped` : ""}.`
        : `${applied} transfer(s) applied to LIST${warningSuffix}${skipped ? `; ${skipped} skipped` : ""}.`,
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || String(error),
    };
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}
