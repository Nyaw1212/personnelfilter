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
    const payload = (Array.isArray(rows) ? rows : [rows])
      .map(row => this.validateRow_(row));

    if (!payload.length) return [];

    let connection;
    let statement;
    const startedAt = Date.now();

    try {
      connection = NeonService.openJdbcConnection_();
      connection.setAutoCommit(false);

      for (
        let start = 0;
        start < payload.length;
        start += this.MAX_ROWS_PER_STATEMENT
      ) {
        const chunk = payload.slice(
          start,
          start + this.MAX_ROWS_PER_STATEMENT
        );

        statement = connection.prepareStatement(this.buildSql_(chunk.length));
        this.bindRows_(statement, chunk);
        statement.executeUpdate();
        NeonService.closeQuietly_(statement);
        statement = null;
      }

      connection.commit();

      const elapsedMs = Date.now() - startedAt;
      console.log(
        "Neon multi-row attendance upsert: %s row(s) in %s ms",
        payload.length,
        elapsedMs
      );

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
      NeonService.closeQuietly_(statement);
      if (connection) {
        try {
          connection.setAutoCommit(true);
        } catch (ignore) {}
      }
      NeonService.closeQuietly_(connection);
    }
  }
});
