//----------------------------------
// Attendance Center Prototype Service
//----------------------------------

const ATTENDANCE_CENTER_CONFIG = Object.freeze({
  spreadsheetId: "1-F2wKpEAVRMLNMDtrmvS5dT-MDP9YoNRaOVeQSKzwtg",
  logSheet: "ATTENDANCE_LOG",
  submissionsSheet: "ATTENDANCE_SUBMISSIONS",
  presetsSheet: "DUTY_PRESETS",
});

const ATTENDANCE_LOG_HEADERS = Object.freeze([
  "Attendance ID",
  "Date",
  "Employee Key",
  "Full Name",
  "Rank",
  "Office",
  "Camp",
  "Duty Detail",
  "Status",
  "Remarks",
  "Submission ID",
  "Encoded By",
  "Timestamp",
  "Updated By",
  "Updated At",
]);

const ATTENDANCE_SUBMISSION_HEADERS = Object.freeze([
  "Submission ID",
  "Attendance Date",
  "Camp",
  "Office",
  "Total Personnel",
  "Present",
  "Absent",
  "Leave",
  "OB",
  "Unrecorded",
  "Submitted By",
  "Submitted At",
  "Status",
  "Remarks",
]);

const DUTY_PRESET_HEADERS = Object.freeze([
  "Preset ID",
  "Preset Name",
  "Description",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
  "Active",
]);

function setupAttendanceCenterSheets() {
  const spreadsheet = SpreadsheetApp.openById(ATTENDANCE_CENTER_CONFIG.spreadsheetId);
  const logSheet = ensureAttendanceSheet_(spreadsheet, ATTENDANCE_CENTER_CONFIG.logSheet, ATTENDANCE_LOG_HEADERS);
  const submissionsSheet = ensureAttendanceSheet_(spreadsheet, ATTENDANCE_CENTER_CONFIG.submissionsSheet, ATTENDANCE_SUBMISSION_HEADERS);
  const presetsSheet = ensureAttendanceSheet_(spreadsheet, ATTENDANCE_CENTER_CONFIG.presetsSheet, DUTY_PRESET_HEADERS);

  logSheet.setFrozenRows(1);
  submissionsSheet.setFrozenRows(1);
  presetsSheet.setFrozenRows(1);
  logSheet.getRange("B:B").setNumberFormat("mm/dd/yyyy");
  logSheet.getRange("M:O").setNumberFormat("mm/dd/yyyy hh:mm:ss");
  submissionsSheet.getRange("B:B").setNumberFormat("mm/dd/yyyy");
  submissionsSheet.getRange("L:L").setNumberFormat("mm/dd/yyyy hh:mm:ss");

  if (presetsSheet.getLastRow() < 2) {
    presetsSheet.getRange(2, 1, 1, DUTY_PRESET_HEADERS.length).setValues([[
      "NORMAL-OFFICE",
      "Normal Office Days",
      "Monday to Friday office duty",
      "PRESENT",
      "PRESENT",
      "PRESENT",
      "PRESENT",
      "PRESENT",
      "OFF",
      "OFF",
      true,
    ]]);
  }

  return { success: true, message: "Attendance Center sheets are ready." };
}

function getAttendanceCenterBootstrap() {
  setupAttendanceCenterSheets();
  const spreadsheet = SpreadsheetApp.openById(ATTENDANCE_CENTER_CONFIG.spreadsheetId);
  const presetsSheet = spreadsheet.getSheetByName(ATTENDANCE_CENTER_CONFIG.presetsSheet);
  const presets = presetsSheet.getLastRow() < 2
    ? []
    : presetsSheet.getRange(2, 1, presetsSheet.getLastRow() - 1, DUTY_PRESET_HEADERS.length)
        .getDisplayValues()
        .filter(row => String(row[0] || "").trim() && String(row[10] || "").toUpperCase() !== "FALSE")
        .map(row => ({ id: row[0], name: row[1], description: row[2] }));

  return {
    success: true,
    presets,
    userEmail: Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || "",
  };
}

function loadAttendanceCenterRecords(request) {
  const source = request && typeof request === "object" ? request : {};
  const dateText = String(source.date || "").trim();
  const camp = normalizeAttendanceValue_(source.camp);
  const office = normalizeAttendanceValue_(source.office);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return { success: true, records: [] };

  setupAttendanceCenterSheets();
  const spreadsheet = SpreadsheetApp.openById(ATTENDANCE_CENTER_CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(ATTENDANCE_CENTER_CONFIG.logSheet);
  if (!sheet || sheet.getLastRow() < 2) return { success: true, records: [] };

  const timezone = Session.getScriptTimeZone();
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, ATTENDANCE_LOG_HEADERS.length).getValues();
  const records = values.filter(row => {
    const date = row[1] instanceof Date ? Utilities.formatDate(row[1], timezone, "yyyy-MM-dd") : String(row[1] || "");
    return date === dateText && normalizeAttendanceValue_(row[6]) === camp && normalizeAttendanceValue_(row[5]) === office;
  }).map(row => ({
    attendanceId: row[0],
    employeeKey: String(row[2] || ""),
    fullName: String(row[3] || ""),
    status: String(row[8] || ""),
    remarks: String(row[9] || ""),
  }));

  return { success: true, records };
}

function saveAttendanceCenterSubmission(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const dateText = String(source.date || "").trim();
  const camp = String(source.camp || "").trim();
  const office = String(source.office || "").trim();
  const dutyDetail = String(source.dutyDetail || "Normal Office Days").trim();
  const records = Array.isArray(source.records) ? source.records : [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) throw new Error("Select a valid attendance date.");
  if (!camp) throw new Error("Select a camp.");
  if (!office) throw new Error("Select an office.");
  if (!records.length) throw new Error("No personnel attendance records were supplied.");

  const validStatuses = new Set(["PRESENT", "ABSENT", "LEAVE", "OB", "UNRECORDED"]);
  records.forEach(record => {
    const status = normalizeAttendanceValue_(record.status || "UNRECORDED");
    if (!validStatuses.has(status)) throw new Error(`Invalid attendance status: ${status}`);
  });

  setupAttendanceCenterSheets();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const spreadsheet = SpreadsheetApp.openById(ATTENDANCE_CENTER_CONFIG.spreadsheetId);
    const logSheet = spreadsheet.getSheetByName(ATTENDANCE_CENTER_CONFIG.logSheet);
    const submissionsSheet = spreadsheet.getSheetByName(ATTENDANCE_CENTER_CONFIG.submissionsSheet);
    const now = new Date();
    const actor = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || "Attendance Center user";
    const parsedDate = parseAttendanceDate_(dateText);
    const submissionId = `ATT-${dateText.replaceAll("-", "")}-${slugAttendanceValue_(camp)}-${slugAttendanceValue_(office)}`;

    const existingValues = logSheet.getLastRow() < 2
      ? []
      : logSheet.getRange(2, 1, logSheet.getLastRow() - 1, ATTENDANCE_LOG_HEADERS.length).getValues();
    const timezone = Session.getScriptTimeZone();
    const existingMap = new Map();
    existingValues.forEach((row, index) => {
      const date = row[1] instanceof Date ? Utilities.formatDate(row[1], timezone, "yyyy-MM-dd") : String(row[1] || "");
      existingMap.set(`${date}|${String(row[2] || "")}`, index + 2);
    });

    const newRows = [];
    records.forEach(record => {
      const employeeKey = String(record.employeeKey || record.sheetRow || record.fullName || "").trim();
      const status = normalizeAttendanceValue_(record.status || "UNRECORDED");
      const row = [
        String(record.attendanceId || Utilities.getUuid()),
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
        actor,
        now,
        actor,
        now,
      ];
      const existingRow = existingMap.get(`${dateText}|${employeeKey}`);
      if (existingRow) {
        const originalId = logSheet.getRange(existingRow, 1).getDisplayValue();
        row[0] = originalId || row[0];
        const originalEncodedBy = logSheet.getRange(existingRow, 12).getDisplayValue();
        const originalTimestamp = logSheet.getRange(existingRow, 13).getValue();
        row[11] = originalEncodedBy || actor;
        row[12] = originalTimestamp || now;
        logSheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
      } else {
        newRows.push(row);
      }
    });

    if (newRows.length) {
      logSheet.getRange(logSheet.getLastRow() + 1, 1, newRows.length, ATTENDANCE_LOG_HEADERS.length).setValues(newRows);
    }

    const counts = { PRESENT: 0, ABSENT: 0, LEAVE: 0, OB: 0, UNRECORDED: 0 };
    records.forEach(record => counts[normalizeAttendanceValue_(record.status || "UNRECORDED")]++);
    const summaryRow = [
      submissionId,
      parsedDate,
      camp,
      office,
      records.length,
      counts.PRESENT,
      counts.ABSENT,
      counts.LEAVE,
      counts.OB,
      counts.UNRECORDED,
      actor,
      now,
      counts.UNRECORDED ? "DRAFT" : "SUBMITTED",
      String(source.remarks || "").trim(),
    ];

    const submissionValues = submissionsSheet.getLastRow() < 2
      ? []
      : submissionsSheet.getRange(2, 1, submissionsSheet.getLastRow() - 1, ATTENDANCE_SUBMISSION_HEADERS.length).getDisplayValues();
    const submissionIndex = submissionValues.findIndex(row => String(row[0] || "").trim() === submissionId);
    if (submissionIndex >= 0) {
      submissionsSheet.getRange(submissionIndex + 2, 1, 1, summaryRow.length).setValues([summaryRow]);
    } else {
      submissionsSheet.getRange(submissionsSheet.getLastRow() + 1, 1, 1, summaryRow.length).setValues([summaryRow]);
    }

    return {
      success: true,
      submissionId,
      count: records.length,
      summary: counts,
      message: `${records.length} attendance record(s) saved for ${office}.`,
    };
  } finally {
    try { lock.releaseLock(); } catch (ignored) {}
  }
}

function ensureAttendanceSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
  }
  return sheet;
}

function normalizeAttendanceValue_(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function slugAttendanceValue_(value) {
  return normalizeAttendanceValue_(value).replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "NA";
}

function parseAttendanceDate_(isoDate) {
  const parts = String(isoDate).split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
