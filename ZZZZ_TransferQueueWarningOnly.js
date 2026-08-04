//----------------------------------
// Transfer Queue warning-only verification + performance timing
//----------------------------------
// Previous-office mismatches are advisory. A uniquely matched personnel
// record may still be applied, while the discrepancy is returned and stored
// as a warning for review.

function canonicalApplyTransfers_(transferIds, approveFirst) {
  const startedAt = Date.now();
  const ids = canonicalIdSet_(transferIds);

  const timing = {
    totalMs: 0,
    lockMs: 0,
    openSpreadsheetMs: 0,
    loadSheetsMs: 0,
    readQueueMs: 0,
    buildIndexMs: 0,
    loopMs: 0,
    liveReadMs: 0,
    listWriteMs: 0,
    verifyFlushMs: 0,
    verifyReadMs: 0,
    queueWriteMs: 0,
    finalFlushMs: 0,
    releaseLockMs: 0,
    selected: ids.size,
    scanned: 0,
    matched: 0,
    applied: 0,
    skipped: 0,
    failed: 0,
    warnings: 0,
  };

  if (!ids.size) {
    return { success: false, message: "Select at least one transfer." };
  }

  console.log(
    "[PERF][TransferQ Apply] START approveFirst=%s selected=%s ids=%s",
    approveFirst,
    ids.size,
    JSON.stringify(Array.from(ids))
  );

  const lock = LockService.getScriptLock();
  const lockStartedAt = Date.now();
  lock.waitLock(30000);
  timing.lockMs = Date.now() - lockStartedAt;

  try {
    const openStartedAt = Date.now();
    const ss = SpreadsheetApp.openById(
      CANONICAL_TRANSFER_QUEUE_CONFIG.spreadsheetId
    );
    timing.openSpreadsheetMs = Date.now() - openStartedAt;

    const sheetsStartedAt = Date.now();
    const queueSheet = getCanonicalTransferQueueSheet_(ss);
    const listSheet = ss.getSheetByName(
      CANONICAL_TRANSFER_QUEUE_CONFIG.personnelSheet
    );
    timing.loadSheetsMs = Date.now() - sheetsStartedAt;

    if (!listSheet) throw new Error("The LIST sheet was not found.");

    const queueReadStartedAt = Date.now();
    const queue = queueSheet.getDataRange().getValues();
    timing.readQueueMs = Date.now() - queueReadStartedAt;

    const indexStartedAt = Date.now();
    const index = buildCanonicalPersonnelIndex_(listSheet);
    timing.buildIndexMs = Date.now() - indexStartedAt;

    const approvedBy =
      Session.getActiveUser().getEmail() || "Personnel Filter user";
    const now = new Date();

    let applied = 0;
    let skipped = 0;
    const failures = [];
    const warnings = [];

    const loopStartedAt = Date.now();

    for (let i = 1; i < queue.length; i++) {
      const rowStartedAt = Date.now();
      const row = queue[i];
      const id = String(row[0] || "").trim();
      if (!ids.has(id)) continue;

      timing.scanned++;

      const status = canonicalDisplayStatus_(row[9]);
      if (["APPLIED", "CANCELLED"].includes(status)) {
        skipped++;
        timing.skipped++;
        continue;
      }

      if (!approveFirst && status !== "APPROVED") {
        failures.push(
          `${String(row[3] || "").trim()}: Transfer must be APPROVED before applying.`
        );
        timing.failed++;
        continue;
      }

      const fullName = String(row[3] || "").trim();
      const previousOffice = String(row[5] || "").trim();
      const newOffice = String(row[7] || "").trim();
      const newCamp = String(row[8] || "").trim();
      const match = canonicalFindMatch_(index, fullName, previousOffice);

      if (!match) {
        const message = "Personnel was not uniquely matched in LIST.";
        const queueWriteStartedAt = Date.now();
        canonicalMarkFailed_(queueSheet, i + 1, message);
        timing.queueWriteMs += Date.now() - queueWriteStartedAt;
        failures.push(`${fullName}: ${message}`);
        timing.failed++;
        continue;
      }

      timing.matched++;

      const liveReadStartedAt = Date.now();
      const liveOffice = String(
        listSheet.getRange(match.rowNumber, 4).getDisplayValue() || ""
      ).trim();
      timing.liveReadMs += Date.now() - liveReadStartedAt;

      const liveOfficeKey = canonicalKey_(liveOffice);
      const previousOfficeKey = canonicalKey_(previousOffice);
      let rowWarning = "";

      if (previousOfficeKey && liveOfficeKey !== previousOfficeKey) {
        rowWarning = liveOfficeKey
          ? `WARNING: Current LIST office is ${liveOffice}, not ${previousOffice}. Transfer applied after advisory review.`
          : `WARNING: Current LIST office is blank; previous office ${previousOffice} could not be verified. Transfer applied.`;

        warnings.push(`${fullName}: ${rowWarning}`);
        timing.warnings++;
        console.warn("[TransferQ][Warning] %s", `${fullName}: ${rowWarning}`);
      }

      const listWriteStartedAt = Date.now();
      if (newOffice) {
        listSheet.getRange(match.rowNumber, 4).setValue(newOffice);
      }
      if (newCamp) {
        listSheet.getRange(match.rowNumber, 6).setValue(newCamp);
      }
      timing.listWriteMs += Date.now() - listWriteStartedAt;

      const verifyFlushStartedAt = Date.now();
      SpreadsheetApp.flush();
      timing.verifyFlushMs += Date.now() - verifyFlushStartedAt;

      const verifyReadStartedAt = Date.now();
      const verifiedOffice = String(
        listSheet.getRange(match.rowNumber, 4).getDisplayValue() || ""
      ).trim();
      const verifiedCamp = String(
        listSheet.getRange(match.rowNumber, 6).getDisplayValue() || ""
      ).trim();
      timing.verifyReadMs += Date.now() - verifyReadStartedAt;

      const officeOk =
        !newOffice || canonicalKey_(verifiedOffice) === canonicalKey_(newOffice);
      const campOk =
        !newCamp || canonicalKey_(verifiedCamp) === canonicalKey_(newCamp);

      if (!officeOk || !campOk) {
        const message =
          `LIST verification failed. Office=${verifiedOffice}; Camp=${verifiedCamp}.`;
        const queueWriteStartedAt = Date.now();
        canonicalMarkFailed_(queueSheet, i + 1, message);
        timing.queueWriteMs += Date.now() - queueWriteStartedAt;
        failures.push(`${fullName}: ${message}`);
        timing.failed++;
        continue;
      }

      const existingApprovedBy = String(row[10] || "").trim();
      const existingApprovedDate = row[11] || "";

      const queueWriteStartedAt = Date.now();
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
      timing.queueWriteMs += Date.now() - queueWriteStartedAt;

      applied++;
      timing.applied++;

      console.log(
        "[PERF][TransferQ Row] id=%s name=%s total=%sms warning=%s",
        id,
        fullName,
        Date.now() - rowStartedAt,
        Boolean(rowWarning)
      );
    }

    timing.loopMs = Date.now() - loopStartedAt;

    const finalFlushStartedAt = Date.now();
    SpreadsheetApp.flush();
    timing.finalFlushMs = Date.now() - finalFlushStartedAt;

    const warningSuffix = warnings.length
      ? `; ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
      : "";

    const result = {
      success: failures.length === 0,
      applied,
      skipped,
      failed: failures.length,
      failures,
      warningCount: warnings.length,
      warnings,
      timing,
      message: failures.length
        ? `${applied} transfer(s) applied; ${failures.length} failed${warningSuffix}${skipped ? `; ${skipped} skipped` : ""}.`
        : `${applied} transfer(s) applied to LIST${warningSuffix}${skipped ? `; ${skipped} skipped` : ""}.`,
    };

    return result;
  } catch (error) {
    timing.failed++;
    return {
      success: false,
      message: error?.message || String(error),
      timing,
    };
  } finally {
    const releaseStartedAt = Date.now();
    try {
      lock.releaseLock();
    } catch (_) {}
    timing.releaseLockMs = Date.now() - releaseStartedAt;
    timing.totalMs = Date.now() - startedAt;

    console.log(
      "[PERF][TransferQ Apply] END total=%sms selected=%s scanned=%s matched=%s applied=%s skipped=%s failed=%s warnings=%s lock=%sms open=%sms sheets=%sms readQueue=%sms buildIndex=%sms loop=%sms liveRead=%sms listWrite=%sms verifyFlush=%sms verifyRead=%sms queueWrite=%sms finalFlush=%sms releaseLock=%sms",
      timing.totalMs,
      timing.selected,
      timing.scanned,
      timing.matched,
      timing.applied,
      timing.skipped,
      timing.failed,
      timing.warnings,
      timing.lockMs,
      timing.openSpreadsheetMs,
      timing.loadSheetsMs,
      timing.readQueueMs,
      timing.buildIndexMs,
      timing.loopMs,
      timing.liveReadMs,
      timing.listWriteMs,
      timing.verifyFlushMs,
      timing.verifyReadMs,
      timing.queueWriteMs,
      timing.finalFlushMs,
      timing.releaseLockMs
    );
  }
}
