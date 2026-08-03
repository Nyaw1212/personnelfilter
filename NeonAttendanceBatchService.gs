// ==================================
// Neon attendance JSON save service
// ==================================
// Sends the complete attendance payload as one JSON parameter and lets
// PostgreSQL expand it with jsonb_to_recordset(). This avoids thousands of
// slow Apps Script JDBC setter calls.

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
    const startedAt = Date.now();
    const timing = {
      validateMs: 0,
      jsonBuildMs: 0,
      connectMs: 0,
      transactionSetupMs: 0,
      sqlBuildMs: 0,
      prepareMs: 0,
      bindMs: 0,
      executeMs: 0,
      commitMs: 0,
      cleanupMs: 0,
      totalMs: 0,
      rows: 0,
      payloadBytes: 0
    };

    const validateStartedAt = Date.now();
    const payload = (Array.isArray(rows) ? rows : [rows])
      .map(row => this.validateRow_(row));
    timing.validateMs = Date.now() - validateStartedAt;
    timing.rows = payload.length;

    if (!payload.length) return [];

    const jsonStartedAt = Date.now();
    const jsonPayload = JSON.stringify(payload);
    timing.jsonBuildMs = Date.now() - jsonStartedAt;
    timing.payloadBytes = jsonPayload.length;

    let connection;
    let statement;

    try {
      const connectStartedAt = Date.now();
      connection = NeonService.openJdbcConnection_();
      timing.connectMs = Date.now() - connectStartedAt;

      const transactionStartedAt = Date.now();
      connection.setAutoCommit(false);
      timing.transactionSetupMs = Date.now() - transactionStartedAt;

      const sqlStartedAt = Date.now();
      const sql = this.buildSql_();
      timing.sqlBuildMs = Date.now() - sqlStartedAt;

      const prepareStartedAt = Date.now();
      statement = connection.prepareStatement(sql);
      timing.prepareMs = Date.now() - prepareStartedAt;

      const bindStartedAt = Date.now();
      statement.setString(1, jsonPayload);
      timing.bindMs = Date.now() - bindStartedAt;

      const executeStartedAt = Date.now();
      statement.executeUpdate();
      timing.executeMs = Date.now() - executeStartedAt;

      const commitStartedAt = Date.now();
      connection.commit();
      timing.commitMs = Date.now() - commitStartedAt;

      return payload.map(row => ({
        personnel_uid: row.personnel_uid,
        attendance_date: row.attendance_date,
        affected: 1
      }));
    } catch (error) {
      if (connection) {
        try {
          connection.rollback();
        } catch (rollbackError) {
          console.error(
            "Neon JSON save rollback failed: " +
            (rollbackError && rollbackError.message
              ? rollbackError.message
              : String(rollbackError))
          );
        }
      }

      throw new Error(
        "Neon attendance JSON save failed; transaction rolled back: " +
        (error && error.message ? error.message : String(error))
      );
    } finally {
      const cleanupStartedAt = Date.now();
      NeonService.closeQuietly_(statement);
      if (connection) {
        try {
          connection.setAutoCommit(true);
        } catch (ignore) {}
      }
      NeonService.closeQuietly_(connection);
      timing.cleanupMs = Date.now() - cleanupStartedAt;
      timing.totalMs = Date.now() - startedAt;

      console.log(
        "[PERF][Neon Save JSON] total=%sms rows=%s payloadBytes=%s validate=%sms jsonBuild=%sms connect=%sms txSetup=%sms sqlBuild=%sms prepare=%sms bind=%sms execute=%sms commit=%sms cleanup=%sms",
        timing.totalMs,
        timing.rows,
        timing.payloadBytes,
        timing.validateMs,
        timing.jsonBuildMs,
        timing.connectMs,
        timing.transactionSetupMs,
        timing.sqlBuildMs,
        timing.prepareMs,
        timing.bindMs,
        timing.executeMs,
        timing.commitMs,
        timing.cleanupMs
      );
    }
  }
});
