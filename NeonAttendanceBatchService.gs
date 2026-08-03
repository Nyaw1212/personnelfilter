// ==================================
// Neon attendance high-speed save service
// ==================================
// Saves a complete attendance payload with one multi-row UPSERT per chunk,
// using one JDBC connection and one database transaction.

const NeonAttendanceBatchService = Object.freeze({
  MAX_ROWS_PER_STATEMENT: 500,

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

  buildSql_(rowCount) {
    const valueGroups = Array.from(
      { length: rowCount },
      () => "(?, CAST(? AS DATE), ?, ?, ?, ?, ?, ?, ?)"
    ).join(", ");

    return [
      "INSERT INTO public.attendance (",
      "personnel_uid, attendance_date, full_name, rank, camp, office,",
      "status, remarks, created_by",
      ") VALUES",
      valueGroups,
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

  bindRows_(statement, rows) {
    let parameter = 1;

    rows.forEach(row => {
      statement.setString(parameter++, String(row.personnel_uid));
      statement.setString(parameter++, String(row.attendance_date));
      statement.setString(parameter++, String(row.full_name));

      if (row.rank == null || String(row.rank).trim() === "") {
        statement.setNull(parameter++, Jdbc.TYPE_VARCHAR);
      } else {
        statement.setString(parameter++, String(row.rank));
      }

      statement.setString(parameter++, String(row.camp));
      statement.setString(parameter++, String(row.office));
      statement.setString(parameter++, String(row.status));

      if (row.remarks == null || String(row.remarks).trim() === "") {
        statement.setNull(parameter++, Jdbc.TYPE_VARCHAR);
      } else {
        statement.setString(parameter++, String(row.remarks));
      }

      statement.setString(parameter++, String(row.created_by));
    });
  },

  save(rows) {
    const startedAt = Date.now();
    const timing = {
      validateMs: 0,
      connectMs: 0,
      transactionSetupMs: 0,
      sqlBuildMs: 0,
      prepareMs: 0,
      bindMs: 0,
      executeMs: 0,
      commitMs: 0,
      cleanupMs: 0,
      totalMs: 0,
      chunks: 0,
      rows: 0
    };

    const validateStartedAt = Date.now();
    const payload = (Array.isArray(rows) ? rows : [rows])
      .map(row => this.validateRow_(row));
    timing.validateMs = Date.now() - validateStartedAt;
    timing.rows = payload.length;

    if (!payload.length) return [];

    let connection;
    let statement;

    try {
      const connectStartedAt = Date.now();
      connection = NeonService.openJdbcConnection_();
      timing.connectMs = Date.now() - connectStartedAt;

      const transactionStartedAt = Date.now();
      connection.setAutoCommit(false);
      timing.transactionSetupMs = Date.now() - transactionStartedAt;

      for (
        let start = 0;
        start < payload.length;
        start += this.MAX_ROWS_PER_STATEMENT
      ) {
        timing.chunks++;
        const chunk = payload.slice(
          start,
          start + this.MAX_ROWS_PER_STATEMENT
        );

        const sqlStartedAt = Date.now();
        const sql = this.buildSql_(chunk.length);
        timing.sqlBuildMs += Date.now() - sqlStartedAt;

        const prepareStartedAt = Date.now();
        statement = connection.prepareStatement(sql);
        timing.prepareMs += Date.now() - prepareStartedAt;

        const bindStartedAt = Date.now();
        this.bindRows_(statement, chunk);
        timing.bindMs += Date.now() - bindStartedAt;

        const executeStartedAt = Date.now();
        statement.executeUpdate();
        timing.executeMs += Date.now() - executeStartedAt;

        NeonService.closeQuietly_(statement);
        statement = null;
      }

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
            "Neon multi-row rollback failed: " +
            (rollbackError && rollbackError.message
              ? rollbackError.message
              : String(rollbackError))
          );
        }
      }

      throw new Error(
        "Neon attendance save failed; transaction rolled back: " +
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
        "[PERF][Neon Save] total=%sms rows=%s chunks=%s validate=%sms connect=%sms txSetup=%sms sqlBuild=%sms prepare=%sms bind=%sms execute=%sms commit=%sms cleanup=%sms",
        timing.totalMs,
        timing.rows,
        timing.chunks,
        timing.validateMs,
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
