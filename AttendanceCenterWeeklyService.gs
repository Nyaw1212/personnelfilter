// Weekly Attendance Center save service.
// Reuses the sheets and helpers defined in AttendanceCenterService.gs.

function saveAttendanceCenterWeek(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const camp = String(source.camp || "").trim();
  const office = String(source.office || "").trim();
  const dutyDetail = String(source.dutyDetail || "Normal Office Days").trim();
  const days = Array.isArray(source.days) ? source.days : [];

  if (!camp) throw new Error("Select a camp.");
  if (!office) throw new Error("Select an office.");
  if (!days.length) throw new Error("No weekly attendance data was supplied.");

  const validStatuses = new Set([
    "PRESENT", "OFF", "ABSENT", "LEAVE", "OB", "UNRECORDED"
  ]);

  days.forEach(day => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day.date || ""))) {
      throw new Error("A weekly attendance date is invalid.");
    }
    if (!Array.isArray(day.records)) {
      throw new Error("A weekly attendance roster is invalid.");
    }
    day.records.forEach(record => {
      const status = normalizeAttendanceValue_(record.status || "UNRECORDED");
      if (!validStatuses.has(status)) {
        throw new Error(`Invalid attendance status: ${status}`);
      }
    });
  });

  setupAttendanceCenterSheets();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const spreadsheet = SpreadsheetApp.openById(ATTENDANCE_CENTER_CONFIG.spreadsheetId);
    const logSheet = spreadsheet.getSheetByName(ATTENDANCE_CENTER_CONFIG.logSheet);
    const submissionsSheet = spreadsheet.getSheetByName(ATTENDANCE_CENTER_CONFIG.submissionsSheet);
    const now = new Date();
    const actor = Session.getActiveUser().getEmail() ||
      Session.getEffectiveUser().getEmail() || "Attendance Center user";
    const timezone = Session.getScriptTimeZone();

    const existingValues = logSheet.getLastRow() < 2
      ? []
      : logSheet.getRange(2, 1, logSheet.getLastRow() - 1, ATTENDANCE_LOG_HEADERS.length).getValues();
    const existingMap = new Map();
    existingValues.forEach((row, index) => {
      const date = row[1] instanceof Date
        ? Utilities.formatDate(row[1], timezone, "yyyy-MM-dd")
        : String(row[1] || "");
      existingMap.set(`${date}|${String(row[2] || "")}`, {
        row: index + 2,
        id: String(row[0] || ""),
        encodedBy: String(row[11] || ""),
        timestamp: row[12] || "",
      });
    });

    const appendRows = [];
    const summaryRows = [];

    days.forEach(day => {
      const dateText = String(day.date);
      const parsedDate = parseAttendanceDate_(dateText);
      const submissionId = `ATT-${dateText.replaceAll("-", "")}-${slugAttendanceValue_(camp)}-${slugAttendanceValue_(office)}`;
      const counts = { PRESENT: 0, OFF: 0, ABSENT: 0, LEAVE: 0, OB: 0, UNRECORDED: 0 };

      day.records.forEach(record => {
        const employeeKey = String(record.employeeKey || record.sheetRow || record.fullName || "").trim();
        const status = normalizeAttendanceValue_(record.status || "UNRECORDED");
        counts[status]++;
        const existing = existingMap.get(`${dateText}|${employeeKey}`);
        const row = [
          existing && existing.id ? existing.id : Utilities.getUuid(),
          parsedDate,
          employeeKey,
          String(record.fullName || "").trim(),
          String(record.rank || "").trim(),
          office,
          camp,
          dutyDetail,
          status,
          String(record.remarks || "").trim(),
          submissionId,
          existing && existing.encodedBy ? existing.encodedBy : actor,
          existing && existing.timestamp ? existing.timestamp : now,
          actor,
          now,
        ];

        if (existing) {
          logSheet.getRange(existing.row, 1, 1, row.length).setValues([row]);
        } else {
          appendRows.push(row);
        }
      });

      summaryRows.push({
        id: submissionId,
        values: [
          submissionId,
          parsedDate,
          camp,
          office,
          day.records.length,
          counts.PRESENT,
          counts.ABSENT,
          counts.LEAVE,
          counts.OB,
          counts.UNRECORDED,
          actor,
          now,
          counts.UNRECORDED ? "DRAFT" : "SUBMITTED",
          `OFF: ${counts.OFF}`,
        ],
      });
    });

    if (appendRows.length) {
      logSheet.getRange(
        logSheet.getLastRow() + 1,
        1,
        appendRows.length,
        ATTENDANCE_LOG_HEADERS.length
      ).setValues(appendRows);
    }

    const existingSubmissions = submissionsSheet.getLastRow() < 2
      ? []
      : submissionsSheet.getRange(
          2, 1,
          submissionsSheet.getLastRow() - 1,
          ATTENDANCE_SUBMISSION_HEADERS.length
        ).getDisplayValues();
    const submissionMap = new Map();
    existingSubmissions.forEach((row, index) => {
      submissionMap.set(String(row[0] || "").trim(), index + 2);
    });

    summaryRows.forEach(summary => {
      const rowNumber = submissionMap.get(summary.id);
      if (rowNumber) {
        submissionsSheet.getRange(rowNumber, 1, 1, summary.values.length).setValues([summary.values]);
      } else {
        submissionsSheet.getRange(
          submissionsSheet.getLastRow() + 1,
          1,
          1,
          summary.values.length
        ).setValues([summary.values]);
      }
    });

    return {
      success: true,
      daysSaved: days.length,
      recordsSaved: days.reduce((sum, day) => sum + day.records.length, 0),
      message: `${days.length} attendance day(s) saved for ${office}.`,
    };
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}
