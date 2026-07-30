//----------------------------------
// Transfer Queue Cancellation
//----------------------------------

function cancelTransferQueueRecords(transferIds) {
  const ids = new Set(
    (Array.isArray(transferIds) ? transferIds : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
  );

  if (!ids.size) {
    return {
      success: false,
      message: "Select at least one transfer to cancel.",
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const spreadsheet = SpreadsheetApp.openById(
      TRANSFER_QUEUE_CONFIG.spreadsheetId
    );
    const sheet = getOrCreateTransferQueueSheet_(spreadsheet);
    const values = sheet.getDataRange().getValues();
    const cancelledBy =
      Session.getActiveUser().getEmail() || "Personnel Filter user";
    const now = new Date();
    let cancelled = 0;
    let skipped = 0;

    for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
      const row = values[rowIndex];
      const transferId = String(row[0] || "").trim();
      if (!ids.has(transferId)) continue;

      const status = String(row[9] || "").trim().toUpperCase();

      // Applied transfers have already changed LIST and cannot be cancelled here.
      if (status === "APPLIED") {
        skipped++;
        continue;
      }

      if (status === "CANCELLED") {
        skipped++;
        continue;
      }

      sheet.getRange(rowIndex + 1, 10).setValue("CANCELLED");
      sheet.getRange(rowIndex + 1, 11).setValue(cancelledBy);
      sheet.getRange(rowIndex + 1, 12).setValue(now);
      sheet.getRange(rowIndex + 1, 13).clearContent();
      sheet.getRange(rowIndex + 1, 15).setValue(
        `Cancelled by ${cancelledBy} on ${Utilities.formatDate(
          now,
          Session.getScriptTimeZone(),
          "yyyy-MM-dd HH:mm"
        )}.`
      );
      cancelled++;
    }

    return {
      success: cancelled > 0,
      cancelled,
      skipped,
      message: cancelled
        ? `${cancelled} transfer(s) cancelled.${skipped ? ` ${skipped} already applied or cancelled transfer(s) were skipped.` : ""}`
        : "No eligible transfers were cancelled.",
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
