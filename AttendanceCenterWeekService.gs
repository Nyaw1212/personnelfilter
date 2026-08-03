// ==================================
// Attendance Center weekly Neon loader
// ==================================
// Loads an entire office week with one Apps Script execution,
// one JDBC connection, and one SQL query.

function loadAttendanceCenterWeek(request) {
  const startedAt = Date.now();
  const timing = {
    validateMs: 0,
    sqlBuildMs: 0,
    connectMs: 0,
    prepareMs: 0,
    bindMs: 0,
    executeMs: 0,
    readRowsMs: 0,
    cleanupMs: 0,
    totalMs: 0
  };

  const validateStartedAt = Date.now();
  const source = request && typeof request === "object" ? request : {};
  const weekStart = String(source.weekStart || "").trim();
  const weekEnd = String(source.weekEnd || "").trim();
  const camp = String(source.camp || "").trim();
  const office = String(source.office || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    throw new Error("A valid week start date is required.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekEnd)) {
    throw new Error("A valid week end date is required.");
  }
  if (!camp) throw new Error("Select a camp.");
  if (!office) throw new Error("Select an office.");
  timing.validateMs = Date.now() - validateStartedAt;

  const sqlStartedAt = Date.now();
  const sql = [
    "SELECT id, personnel_uid, attendance_date::text AS attendance_date_text,",
    "full_name, rank, camp, office, status, remarks, created_by,",
    "created_at::text AS created_at_text, updated_by,",
    "updated_at::text AS updated_at_text",
    "FROM public.attendance",
    "WHERE attendance_date BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)",
    "AND camp = ? AND office = ?",
    "ORDER BY attendance_date ASC, full_name ASC"
  ].join(" ");
  timing.sqlBuildMs = Date.now() - sqlStartedAt;

  let connection;
  let statement;
  let resultSet;
  const records = [];

  try {
    const connectStartedAt = Date.now();
    connection = NeonService.openJdbcConnection_();
    timing.connectMs = Date.now() - connectStartedAt;

    const prepareStartedAt = Date.now();
    statement = connection.prepareStatement(sql);
    timing.prepareMs = Date.now() - prepareStartedAt;

    const bindStartedAt = Date.now();
    statement.setString(1, weekStart);
    statement.setString(2, weekEnd);
    statement.setString(3, camp);
    statement.setString(4, office);
    timing.bindMs = Date.now() - bindStartedAt;

    const executeStartedAt = Date.now();
    resultSet = statement.executeQuery();
    timing.executeMs = Date.now() - executeStartedAt;

    const readStartedAt = Date.now();
    while (resultSet.next()) {
      records.push({
        attendanceId: resultSet.getLong("id"),
        attendanceDate: resultSet.getString("attendance_date_text"),
        employeeKey: String(resultSet.getString("personnel_uid") || ""),
        fullName: String(resultSet.getString("full_name") || ""),
        rank: String(resultSet.getString("rank") || ""),
        office: String(resultSet.getString("office") || ""),
        camp: String(resultSet.getString("camp") || ""),
        status: String(resultSet.getString("status") || "UNRECORDED"),
        remarks: String(resultSet.getString("remarks") || ""),
        createdBy: String(resultSet.getString("created_by") || ""),
        createdAt: resultSet.getString("created_at_text") || null,
        updatedBy: String(resultSet.getString("updated_by") || ""),
        updatedAt: resultSet.getString("updated_at_text") || null
      });
    }
    timing.readRowsMs = Date.now() - readStartedAt;
  } finally {
    const cleanupStartedAt = Date.now();
    NeonService.closeQuietly_(resultSet);
    NeonService.closeQuietly_(statement);
    NeonService.closeQuietly_(connection);
    timing.cleanupMs = Date.now() - cleanupStartedAt;
  }

  timing.totalMs = Date.now() - startedAt;
  console.log(
    "[PERF][Neon Load] total=%sms rows=%s validate=%sms sqlBuild=%sms connect=%sms prepare=%sms bind=%sms execute=%sms readRows=%sms cleanup=%sms week=%s..%s camp=%s office=%s",
    timing.totalMs,
    records.length,
    timing.validateMs,
    timing.sqlBuildMs,
    timing.connectMs,
    timing.prepareMs,
    timing.bindMs,
    timing.executeMs,
    timing.readRowsMs,
    timing.cleanupMs,
    weekStart,
    weekEnd,
    camp,
    office
  );

  return {
    success: true,
    storage: "NEON_JDBC_WEEK",
    weekStart,
    weekEnd,
    records,
    timing
  };
}
