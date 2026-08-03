// ==================================
// Attendance Center weekly Neon loader
// ==================================
// Loads an entire office week with one Apps Script execution,
// one JDBC connection, one SQL query, and one JDBC payload read.

function loadAttendanceCenterWeek(request) {
  const startedAt = Date.now();
  const timing = {
    validateMs: 0,
    sqlBuildMs: 0,
    connectMs: 0,
    prepareMs: 0,
    bindMs: 0,
    executeMs: 0,
    readPayloadMs: 0,
    parseJsonMs: 0,
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
    "SELECT COALESCE(json_agg(row_to_json(q)), '[]'::json)::text AS payload",
    "FROM (",
    "SELECT id AS \"attendanceId\",",
    "attendance_date::text AS \"attendanceDate\",",
    "personnel_uid AS \"employeeKey\",",
    "full_name AS \"fullName\",",
    "COALESCE(rank, '') AS rank,",
    "office, camp,",
    "COALESCE(status, 'UNRECORDED') AS status,",
    "COALESCE(remarks, '') AS remarks,",
    "COALESCE(created_by, '') AS \"createdBy\",",
    "created_at::text AS \"createdAt\",",
    "COALESCE(updated_by, '') AS \"updatedBy\",",
    "updated_at::text AS \"updatedAt\"",
    "FROM public.attendance",
    "WHERE attendance_date BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)",
    "AND camp = ? AND office = ?",
    "ORDER BY attendance_date ASC, full_name ASC",
    ") q"
  ].join(" ");
  timing.sqlBuildMs = Date.now() - sqlStartedAt;

  let connection;
  let statement;
  let resultSet;
  let records = [];

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
    let payloadText = "[]";
    if (resultSet.next()) {
      payloadText = resultSet.getString("payload") || "[]";
    }
    timing.readPayloadMs = Date.now() - readStartedAt;

    const parseStartedAt = Date.now();
    const parsed = JSON.parse(payloadText);
    records = Array.isArray(parsed) ? parsed : [];
    timing.parseJsonMs = Date.now() - parseStartedAt;
  } finally {
    const cleanupStartedAt = Date.now();
    NeonService.closeQuietly_(resultSet);
    NeonService.closeQuietly_(statement);
    NeonService.closeQuietly_(connection);
    timing.cleanupMs = Date.now() - cleanupStartedAt;
  }

  timing.totalMs = Date.now() - startedAt;
  console.log(
    "[PERF][Neon Load JSON] total=%sms rows=%s validate=%sms sqlBuild=%sms connect=%sms prepare=%sms bind=%sms execute=%sms readPayload=%sms parseJson=%sms cleanup=%sms week=%s..%s camp=%s office=%s",
    timing.totalMs,
    records.length,
    timing.validateMs,
    timing.sqlBuildMs,
    timing.connectMs,
    timing.prepareMs,
    timing.bindMs,
    timing.executeMs,
    timing.readPayloadMs,
    timing.parseJsonMs,
    timing.cleanupMs,
    weekStart,
    weekEnd,
    camp,
    office
  );

  return {
    success: true,
    storage: "NEON_JDBC_WEEK_JSON",
    weekStart,
    weekEnd,
    records,
    timing
  };
}
