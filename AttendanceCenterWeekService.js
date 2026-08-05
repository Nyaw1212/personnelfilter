// ==================================
// Attendance Center weekly Neon loader
// ==================================
// Loads an entire office week through the reusable NeonJsonEngine.

function loadAttendanceCenterWeek(request) {
  const startedAt = Date.now();
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

  const result = NeonJsonEngine.queryJson({
    name: "AttendanceCenterWeekLoad",
    sql,
    params: [weekStart, weekEnd, camp, office],
    defaultValue: []
  });
  const records = Array.isArray(result.data) ? result.data : [];
  const totalMs = Date.now() - startedAt;

  console.log(
    "[PERF][AttendanceCenterWeekService] total=%sms engine=%sms rows=%s week=%s..%s camp=%s office=%s",
    totalMs,
    result.timing.totalMs,
    records.length,
    weekStart,
    weekEnd,
    camp,
    office
  );

  return {
    success: true,
    storage: "NEON_JSON_ENGINE",
    weekStart,
    weekEnd,
    records,
    timing: Object.assign({}, result.timing, { serviceTotalMs: totalMs })
  };
}
