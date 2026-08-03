// ==================================
// Attendance business service
// ==================================
// Validates and prepares attendance snapshots before storage.
// Neon JDBC is the primary attendance storage path.

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
      return {
        success: true,
        storage: "NEON_JDBC_BATCH",
        saved: 0,
        records: []
      };
    }

    const normalized = source.map(record => this.normalizeRecord_(record));
    const saved = normalized.length > 1
      ? NeonAttendanceBatchService.save(normalized)
      : NeonService.insertAttendance(normalized);

    return {
      success: true,
      storage: normalized.length > 1 ? "NEON_JDBC_BATCH" : "NEON_JDBC",
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
    office: "CASO",
    personnelUid
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

// ==================================
// Phase 2.3 batch transaction verification
// ==================================
// Saves five rows in one transaction, reads them back, then updates one of
// those same personnel/date records to verify ON CONFLICT upsert behavior.
function testAttendanceBatchViaJdbc() {
  const now = new Date();
  const suffix = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss"
  );
  const attendanceDate = ServerUtils.formatIsoDate(now);
  const people = [
    ["Alvin Chiao", "CO1", "PRESENT"],
    ["Batch Test Two", "CO2", "LEAVE"],
    ["Batch Test Three", "CO3", "OB"],
    ["Batch Test Four", "CSO1", "OFF"],
    ["Batch Test Five", "CSO2", "ABSENT"]
  ];

  const records = people.map((person, index) => ({
    personnelUid: "PHASE23-BATCH-" + suffix + "-" + (index + 1),
    attendanceDate,
    fullName: person[0],
    rank: person[1],
    camp: "NBP",
    office: "CASO",
    status: person[2],
    remarks: "Phase 2.3 JDBC batch transaction test"
  }));

  const firstSave = AttendanceService.saveAttendance(records);
  const loaded = AttendanceService.loadAttendance({
    attendanceDate,
    camp: "NBP",
    office: "CASO"
  });
  const expectedUids = records.map(record => record.personnelUid);
  const matched = loaded.filter(row => expectedUids.includes(row.personnel_uid));

  const updatedRecord = Object.assign({}, records[0], {
    status: "LEAVE",
    remarks: "Phase 2.3 upsert verification"
  });
  const updateSave = NeonAttendanceBatchService.save([
    AttendanceService.normalizeRecord_(updatedRecord)
  ]);
  const updatedRows = AttendanceService.loadAttendance({
    attendanceDate,
    personnelUid: updatedRecord.personnelUid
  });
  const updatedMatch = updatedRows[0] || null;

  const result = {
    success:
      firstSave.saved === records.length &&
      matched.length === records.length &&
      Boolean(updatedMatch && updatedMatch.status === "LEAVE"),
    storage: firstSave.storage,
    inserted: firstSave.saved,
    matched: matched.length,
    upserted: updateSave.length,
    updatedStatus: updatedMatch ? updatedMatch.status : null,
    personnelUids: expectedUids
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}
