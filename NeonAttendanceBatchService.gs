// ==================================
// Neon attendance batch service
// ==================================
// Phase 2.3: saves many attendance snapshots using one JDBC connection,
// one prepared statement, and one database transaction.

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

  bindRow_(statement, row) {
    statement.setString(1, String(row.personnel_uid));
    statement.setString(2, String(row.attendance_date));
    statement.setString(3, String(row.full_name));

    if (row.rank == null || String(row.rank).trim() === "") {
      statement.setNull(4, Jdbc.TYPE_VARCHAR);
    } else {
      statement.setString(4, String(row.rank));
    }

    statement.setString(5, String(row.camp));
    statement.setString(6, String(row.office));
    statement.setString(7, String(row.status));

    if (row.remarks == null || String(row.remarks).trim() === "") {
      statement.setNull(8, Jdbc.TYPE_VARCHAR);
    } else {
      statement.setString(8, String(row.remarks));
    }

    statement.setString(9, String(row.created_by));
    statement.setString(10, String(row.created_by));
  },

  save(rows) {
    const payload = (Array.isArray(rows) ? rows : [rows])
      .map(row => this.validateRow_(row));

    if (!payload.length) return [];

    const sql = [
      "INSERT INTO public.attendance (",
      "personnel_uid, attendance_date, full_name, rank, camp, office,",
      "status, remarks, created_by",
      ") VALUES (?, CAST(? AS DATE), ?, ?, ?, ?, ?, ?, ?)",
      "ON CONFLICT (personnel_uid, attendance_date) DO UPDATE SET",
      "full_name = EXCLUDED.full_name,",
      "rank = EXCLUDED.rank,",
      "camp = EXCLUDED.camp,",
      "office = EXCLUDED.office,",
      "status = EXCLUDED.status,",
      "remarks = EXCLUDED.remarks,",
      "updated_by = ?,",
      "updated_at = NOW()"
    ].join(" ");

    let connection;
    let statement;

    try {
      connection = NeonService.openJdbcConnection_();
      connection.setAutoCommit(false);
      statement = connection.prepareStatement(sql);

      payload.forEach(row => {
        this.bindRow_(statement, row);
        statement.addBatch();
      });

      const counts = statement.executeBatch();
      connection.commit();

      return payload.map((row, index) => ({
        personnel_uid: row.personnel_uid,
        attendance_date: row.attendance_date,
        affected: Number(counts[index] == null ? 0 : counts[index])
      }));
    } catch (error) {
      if (connection) {
        try {
          connection.rollback();
        } catch (rollbackError) {
          console.error(
            "Neon batch rollback failed: " +
            (rollbackError && rollbackError.message
              ? rollbackError.message
              : String(rollbackError))
          );
        }
      }

      throw new Error(
        "Neon attendance batch save failed; transaction rolled back: " +
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
