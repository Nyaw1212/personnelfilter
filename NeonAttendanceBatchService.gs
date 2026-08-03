// ==================================
// Neon attendance JSON save service
// ==================================
// Attendance-specific validation and SQL now delegate transport,
// transactions, cleanup, and performance logging to NeonJsonEngine.

const NeonAttendanceBatchService = Object.freeze({
  validateRow_(record) {
    const row = record || {};
    const required = [
      "personnel_uid",
      "attendance_date",
      "full_name",
      "camp",
      "office",
      "status",
      "created_by"
    ];

    required.forEach(field => {
      if (!ServerUtils.normalizeText(row[field])) {
        throw new Error("Missing required attendance field: " + field);
      }
    });

    return row;
  },

  buildSql_() {
    return [
      "WITH source_rows AS (",
      "SELECT * FROM jsonb_to_recordset(CAST(? AS jsonb)) AS x(",
      "personnel_uid text, attendance_date text, full_name text, rank text,",
      "camp text, office text, status text, remarks text, created_by text",
      ")",
      ")",
      "INSERT INTO public.attendance (",
      "personnel_uid, attendance_date, full_name, rank, camp, office,",
      "status, remarks, created_by",
      ")",
      "SELECT",
      "personnel_uid, CAST(attendance_date AS date), full_name, rank, camp,",
      "office, status, remarks, created_by",
      "FROM source_rows",
      "ON CONFLICT (personnel_uid, attendance_date) DO UPDATE SET",
      "full_name = EXCLUDED.full_name,",
      "rank = EXCLUDED.rank,",
      "camp = EXCLUDED.camp,",
      "office = EXCLUDED.office,",
      "status = EXCLUDED.status,",
      "remarks = EXCLUDED.remarks,",
      "updated_by = EXCLUDED.created_by,",
      "updated_at = NOW()"
    ].join(" ");
  },

  save(rows) {
    const validateStartedAt = Date.now();
    const payload = (Array.isArray(rows) ? rows : [rows])
      .map(row => this.validateRow_(row));
    const validateMs = Date.now() - validateStartedAt;

    if (!payload.length) return [];

    const result = NeonJsonEngine.executeJson({
      name: "AttendanceBatchUpsert",
      sql: this.buildSql_(),
      payload,
      useTransaction: true
    });

    console.log(
      "[PERF][NeonAttendanceBatchService] total=%sms engine=%sms validate=%sms rows=%s affected=%s",
      result.timing.totalMs + validateMs,
      result.timing.totalMs,
      validateMs,
      payload.length,
      result.affectedRows
    );

    return payload.map(row => ({
      personnel_uid: row.personnel_uid,
      attendance_date: row.attendance_date,
      affected: 1
    }));
  }
});
