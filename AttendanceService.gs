// ==================================
// Attendance business service
// ==================================
// Validates and prepares attendance snapshots before storage.

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
      saved: Array.isArray(saved) ? saved.length : normalized.length,
      records: saved
    };
  },

  loadAttendance(filters) {
    return NeonService.getAttendance(filters || {});
  }
});

// ==================================
// Phase 2 proof-of-connection
// ==================================
// Run this manually from the Apps Script editor after adding
// NEON_DATA_API_URL to Script Properties.
function testInsertOneAttendanceRowToNeon() {
  const result = AttendanceService.saveAttendance({
    personnelUid: "PHASE2-TEST-001",
    attendanceDate: new Date(),
    fullName: "Alvin Chiao",
    rank: "CO1",
    camp: "NBP",
    office: "CASO",
    status: "PRESENT",
    remarks: "Phase 2 Apps Script to Neon connection test"
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}

function testReadAttendanceFromNeon() {
  const rows = AttendanceService.loadAttendance({
    attendanceDate: ServerUtils.formatIsoDate(new Date()),
    camp: "NBP",
    office: "CASO"
  });

  console.log(JSON.stringify(rows, null, 2));
  return rows;
}
