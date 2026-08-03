// Weekly Attendance Center save service.
// Personnel still comes from Google Sheets; attendance history is stored in Neon.

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
  const actor = ServerUtils.getCurrentUserEmail();
  const neonRecords = [];

  days.forEach(day => {
    const dateText = String(day.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
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

      const employeeKey = String(
        record.employeeKey || record.sheetRow || record.fullName || ""
      ).trim();
      const fullName = String(record.fullName || "").trim();

      if (!employeeKey) throw new Error("A personnel storage key is missing.");
      if (!fullName) throw new Error("A personnel name is missing.");

      const recordRemarks = String(record.remarks || "").trim();
      neonRecords.push({
        personnelUid: employeeKey,
        attendanceDate: dateText,
        fullName,
        rank: String(record.rank || "").trim(),
        camp,
        office,
        status,
        remarks: recordRemarks || dutyDetail,
        createdBy: actor,
        updatedBy: actor
      });
    });
  });

  const result = AttendanceService.saveAttendance(neonRecords);
  const recordsSaved = Number(result && result.saved) || 0;

  return {
    success: Boolean(result && result.success),
    storage: result && result.storage || "NEON_JDBC_BATCH",
    daysSaved: days.length,
    recordsSaved,
    message: `${days.length} attendance day(s) saved to Neon for ${office}.`
  };
}
