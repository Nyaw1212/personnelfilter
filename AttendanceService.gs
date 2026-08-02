// ==================================
// Attendance business service
// ==================================
// Validates and prepares attendance snapshots before storage.
// NeonService now handles writes and reads through JDBC.

const AttendanceService = Object.freeze({
  normalizeRecord_(record) {
    const source = record || {};
    const status = ServerUtils.normalizeUpper(source.status);

    if (!APP_CONFIG.ATTENDANCE_STATUSES.includes(status)) {
      throw new Error("Invalid attendance status: " + status);
    }

    const normalized = {
      personnel_uid: ServerUtils.normalizeText(source.personnelUid),
      attendance_date: ServerUtils.formatIsoDate(source.attendanceDate),
      full_name: ServerUtils.normalizeText(source.fullName),
      rank: ServerUtils.normalizeText(source.rank) || null,
      camp: ServerUtils.normalizeText(source.camp),
      office: ServerUtils.normalizeText(source.office),
      status,
      remarks: ServerUtils.normalizeText(source.remarks) || null,
      created_by: ServerUtils.normalizeText(source.createdBy) ||
        ServerUtils.getCurrentUserEmail()
    };

    ["personnel_uid", "full_name", "camp", "office"].forEach(field => {
      if (!normalized[field]) {
        throw new Error("Missing required attendance field: " + field);
      }
    });

    return normalized;
  },

  saveAttendance(records) {
    const source = Array.isArray(records) ? records : [records];
    if (!source.length) {
      return { success: true, saved: 0, records: [] };
    }

    const normalized = source.map(record => this.normalizeRecord_(record));
    const saved = NeonService.insertAttendance(normalized) || [];

    return {
      success: true,
      storage: "NEON_JDBC",
      saved: Array.isArray(saved) ? saved.length : normalized.length,
      records: saved
    };
  },

  loadAttendance(filters) {
    return NeonService.getAttendance(filters || {});
  }
});

// ==================================
// Phase 2.2 service-layer verification
// ==================================
// This confirms that the real AttendanceService path now writes to and reads
// from Neon through JDBC. It is still isolated from the live Save Week button.
function testAttendanceServiceViaJdbc() {
  const now = new Date();
  const suffix = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss"
  );
  const attendanceDate = ServerUtils.formatIsoDate(now);
  const personnelUid = "PHASE22-SERVICE-" + suffix;

  const saved = AttendanceService.saveAttendance({
    personnelUid,
    attendanceDate,
    fullName: "Alvin Chiao",
    rank: "CO1",
    camp: "NBP",
    office: "CASO",
    status: "PRESENT",
    remarks: "Phase 2.2 AttendanceService JDBC verification"
  });

  const rows = AttendanceService.loadAttendance({
    attendanceDate,
    camp: "NBP",
    office: "CASO"
  });

  const matched = rows.find(row => row.personnel_uid === personnelUid) || null;
  const result = {
    success: Boolean(matched),
    storage: saved.storage,
    saved: saved.saved,
    matched
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}
