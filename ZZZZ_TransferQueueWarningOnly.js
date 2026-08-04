//----------------------------------
// Transfer Queue warning-only verification + batch performance engine
//----------------------------------
// Reads LIST and TRANSFER_QUEUE once, updates values in memory, writes each
// sheet once, flushes once, and verifies the affected LIST rows in one read.

function canonicalApplyTransfers_(transferIds, approveFirst) {
  const startedAt = Date.now();
  const ids = canonicalIdSet_(transferIds);

  const timing = {
    totalMs: 0,
    lockMs: 0,
    openSpreadsheetMs: 0,
    loadSheetsMs: 0,
    readQueueMs: 0,
    readListMs: 0,
    buildIndexMs: 0,
    planMs: 0,
    listBatchWriteMs: 0,
    flushMs: 0,
    verifyReadMs: 0,
    queueBatchWriteMs: 0,
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
    "[PERF][TransferQ Batch Apply] START approveFirst=%s selected=%s",
    approveFirst,
    ids.size
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

    const lastListRow = listSheet.getLastRow();
    if (lastListRow < 2) throw new Error("The LIST sheet has no personnel rows.");

    const listRowCount = lastListRow - 1;
    const listReadStartedAt = Date.now();

    // D:F contains Office, the untouched middle column, and Camp.
    const listAssignmentValues = listSheet
      .getRange(2, 4, listRowCount, 3)
      .getValues();

    // R:S contains CANONICAL NAME WITH RANK and PERSONNEL SEARCH KEY.
    const listIdentityValues = listSheet
      .getRange(2, 18, listRowCount, 2)
      .getDisplayValues();

    timing.readListMs = Date.now() - listReadStartedAt;

    const indexStartedAt = Date.now();
    const recordsByName = new Map();

    for (let rowOffset = 0; rowOffset < listRowCount; rowOffset++) {
      const canonicalWithRank = String(
        listIdentityValues[rowOffset][0] || ""
      ).trim();
      const storedSearchKey = canonicalKey_(
        listIdentityValues[rowOffset][1] || canonicalWithRank
      );
      const nameWithoutRank = canonicalNormalizeName_(canonicalWithRank, "");
      const keys = new Set([
        storedSearchKey,
        canonicalKey_(canonicalWithRank),
        canonicalKey_(nameWithoutRank),
      ].filter(Boolean));

      const record = {
        rowNumber: rowOffset + 2,
        rowOffset,
        fullName: nameWithoutRank,
        office: String(listAssignmentValues[rowOffset][0] || "").trim(),
        camp: String(listAssignmentValues[rowOffset][2] || "").trim(),
      };

      keys.forEach(key => {
        const bucket = recordsByName.get(key) || [];
        bucket.push(record);
        recordsByName.set(key, bucket);
      });
    }
    timing.buildIndexMs = Date.now() - indexStartedAt;

    const approvedBy =
      Session.getActiveUser().getEmail() || "Personnel Filter user";
    const now = new Date();
    const failures = [];
    const warnings = [];
    const planned = [];
    let skipped = 0;

    const planStartedAt = Date.now();

    for (let queueOffset = 1; queueOffset < queue.length; queueOffset++) {
      const row = queue[queueOffset];
      const id = String(row[0] || "").trim();
      if (!ids.has(id)) continue;

      timing.scanned++;
      const status = canonicalDisplayStatus_(row[9]);

      if (["APPLIED", "CANCELLED"].includes(status)) {
        skipped++;
        timing.skipped++;
        continue;
      }

      const fullName = String(row[3] || "").trim();

      if (!approveFirst && status !== "APPROVED") {
        const message = "Transfer must be APPROVED before applying.";
        row[9] = "FAILED";
        row[14] = message;
        failures.push(`${fullName}: ${message}`);
        timing.failed++;
        continue;
      }

      const previousOffice = String(row[5] || "").trim();
      const newOffice = String(row[7] || "").trim();
      const newCamp = String(row[8] || "").trim();
      const nameKey = canonicalKey_(fullName);
      let matches = (recordsByName.get(nameKey) || []).slice();

      if (matches.length > 1 && previousOffice) {
        const officeKey = canonicalKey_(previousOffice);
        const officeMatches = matches.filter(record =>
          canonicalKey_(record.office) === officeKey
        );
        if (officeMatches.length) matches = officeMatches;
      }

      if (matches.length !== 1) {
        const message = "Personnel was not uniquely matched in LIST.";
        row[9] = "FAILED";
        row[14] = message;
        failures.push(`${fullName}: ${message}`);
        timing.failed++;
        continue;
      }

      const match = matches[0];
      timing.matched++;

      const liveOfficeKey = canonicalKey_(match.office);
      const previousOfficeKey = canonicalKey_(previousOffice);
      let rowWarning = "";

      if (previousOfficeKey && liveOfficeKey !== previousOfficeKey) {
        rowWarning = liveOfficeKey
          ? `WARNING: Current LIST office is ${match.office}, not ${previousOffice}. Transfer applied after advisory review.`
          : `WARNING: Current LIST office is blank; previous office ${previousOffice} could not be verified. Transfer applied.`;
        warnings.push(`${fullName}: ${rowWarning}`);
        timing.warnings++;
      }

      if (newOffice) listAssignmentValues[match.rowOffset][0] = newOffice;
      if (newCamp) listAssignmentValues[match.rowOffset][2] = newCamp;

      planned.push({
        queueOffset,
        listRowOffset: match.rowOffset,
        fullName,
        newOffice,
        newCamp,
        rowWarning,
      });
    }

    timing.planMs = Date.now() - planStartedAt;

    if (planned.length) {
      const listWriteStartedAt = Date.now();
      listSheet
        .getRange(2, 4, listRowCount, 3)
        .setValues(listAssignmentValues);
      timing.listBatchWriteMs = Date.now() - listWriteStartedAt;

      const flushStartedAt = Date.now();
      SpreadsheetApp.flush();
      timing.flushMs = Date.now() - flushStartedAt;

      const verifyStartedAt = Date.now();
      const verifiedAssignments = listSheet
        .getRange(2, 4, listRowCount, 3)
        .getDisplayValues();
      timing.verifyReadMs = Date.now() - verifyStartedAt;

      planned.forEach(item => {
        const queueRow = queue[item.queueOffset];
        const verifiedOffice = String(
          verifiedAssignments[item.listRowOffset][0] || ""
        ).trim();
        const verifiedCamp = String(
          verifiedAssignments[item.listRowOffset][2] || ""
        ).trim();

        const officeOk =
          !item.newOffice ||
          canonicalKey_(verifiedOffice) === canonicalKey_(item.newOffice);
        const campOk =
          !item.newCamp ||
          canonicalKey_(verifiedCamp) === canonicalKey_(item.newCamp);

        if (!officeOk || !campOk) {
          const message =
            `LIST verification failed. Office=${verifiedOffice}; Camp=${verifiedCamp}.`;
          queueRow[9] = "FAILED";
          queueRow[14] = message;
          failures.push(`${item.fullName}: ${message}`);
          timing.failed++;
          return;
        }

        const existingApprovedBy = String(queueRow[10] || "").trim();
        const existingApprovedDate = queueRow[11] || "";
        queueRow[9] = "APPLIED";
        queueRow[10] = existingApprovedBy || approvedBy;
        queueRow[11] = existingApprovedDate || now;
        queueRow[12] = now;
        queueRow[14] = item.rowWarning || "";
        timing.applied++;
      });
    }

    const queueWriteStartedAt = Date.now();
    if (queue.length > 1) {
      queueSheet
        .getRange(2, 1, queue.length - 1, CANONICAL_TRANSFER_QUEUE_HEADERS.length)
        .setValues(queue.slice(1));
    }
    timing.queueBatchWriteMs = Date.now() - queueWriteStartedAt;

    const finalFlushStartedAt = Date.now();
    SpreadsheetApp.flush();
    timing.finalFlushMs = Date.now() - finalFlushStartedAt;

    const warningSuffix = warnings.length
      ? `; ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
      : "";

    return {
      success: failures.length === 0,
      applied: timing.applied,
      skipped,
      failed: failures.length,
      failures,
      warningCount: warnings.length,
      warnings,
      timing,
      message: failures.length
        ? `${timing.applied} transfer(s) applied; ${failures.length} failed${warningSuffix}${skipped ? `; ${skipped} skipped` : ""}.`
        : `${timing.applied} transfer(s) applied to LIST${warningSuffix}${skipped ? `; ${skipped} skipped` : ""}.`,
    };
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
      "[PERF][TransferQ Batch Apply] END total=%sms selected=%s scanned=%s matched=%s applied=%s skipped=%s failed=%s warnings=%s lock=%sms open=%sms sheets=%sms readQueue=%sms readList=%sms buildIndex=%sms plan=%sms listBatchWrite=%sms flush=%sms verifyRead=%sms queueBatchWrite=%sms finalFlush=%sms releaseLock=%sms",
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
      timing.readListMs,
      timing.buildIndexMs,
      timing.planMs,
      timing.listBatchWriteMs,
      timing.flushMs,
      timing.verifyReadMs,
      timing.queueBatchWriteMs,
      timing.finalFlushMs,
      timing.releaseLockMs
    );
  }
}
