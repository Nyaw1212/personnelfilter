// ==================================
// Neon database service
// ==================================
// JDBC is the primary server-side connection for attendance storage.
// Data API helpers remain available temporarily during migration.

const NeonService = Object.freeze({
  getConfig_() {
    const properties = PropertiesService.getScriptProperties();
    const apiUrl = ServerUtils.normalizeText(
      properties.getProperty(APP_CONFIG.NEON.DATA_API_URL_PROPERTY)
    ).replace(/\/+$/, "");
    const token = ServerUtils.normalizeText(
      properties.getProperty(APP_CONFIG.NEON.DATA_API_TOKEN_PROPERTY)
    );

    if (!apiUrl) {
      throw new Error(
        "Missing NEON_DATA_API_URL in Apps Script Script Properties."
      );
    }

    return { apiUrl, token };
  },

  getJdbcConfig_() {
    const properties = PropertiesService.getScriptProperties();
    const host = ServerUtils.normalizeText(properties.getProperty("NEON_HOST"));
    const database = ServerUtils.normalizeText(
      properties.getProperty("NEON_DATABASE")
    );
    const user = ServerUtils.normalizeText(properties.getProperty("NEON_USER"));
    const password = String(properties.getProperty("NEON_PASSWORD") || "");
    const port = ServerUtils.normalizeText(properties.getProperty("NEON_PORT")) ||
      "5432";

    const missing = [];
    if (!host) missing.push("NEON_HOST");
    if (!database) missing.push("NEON_DATABASE");
    if (!user) missing.push("NEON_USER");
    if (!password) missing.push("NEON_PASSWORD");

    if (missing.length) {
      throw new Error(
        "Missing Neon JDBC Script Properties: " + missing.join(", ")
      );
    }

    return {
      host,
      database,
      user,
      password,
      port,
      jdbcUrl:
        "jdbc:postgresql://" + host + ":" + port + "/" + database
    };
  },

  openJdbcConnection_() {
    const config = this.getJdbcConfig_();
    return Jdbc.getConnection(
      config.jdbcUrl,
      config.user,
      config.password
    );
  },

  closeQuietly_(resource) {
    if (!resource) return;
    try {
      resource.close();
    } catch (error) {
      console.warn(
        "Neon JDBC resource close warning: " +
        (error && error.message ? error.message : String(error))
      );
    }
  },

  testJdbcConnection() {
    const config = this.getJdbcConfig_();
    let connection;

    try {
      console.log(
        "Testing Neon JDBC connection to %s:%s/%s",
        config.host,
        config.port,
        config.database
      );

      connection = this.openJdbcConnection_();

      const result = {
        success: true,
        message: "Connected to Neon successfully.",
        catalog: connection.getCatalog(),
        autoCommit: connection.getAutoCommit()
      };

      console.log(JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      console.error("Neon JDBC connection failed: " + message);
      throw new Error("Neon JDBC connection failed: " + message);
    } finally {
      this.closeQuietly_(connection);
    }
  },

  insertAttendanceJdbc(record) {
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

    const sql = [
      "INSERT INTO public.attendance (",
      "personnel_uid, attendance_date, full_name, rank, camp, office,",
      "status, remarks, created_by",
      ") VALUES (?, CAST(? AS DATE), ?, ?, ?, ?, ?, ?, ?)",
      "RETURNING id, personnel_uid, attendance_date, full_name, rank,",
      "camp, office, status, remarks, created_by, created_at"
    ].join(" ");

    let connection;
    let statement;
    let resultSet;

    try {
      connection = this.openJdbcConnection_();
      statement = connection.prepareStatement(sql);
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
      resultSet = statement.executeQuery();

      if (!resultSet.next()) {
        throw new Error("Neon insert completed without returning a row.");
      }

      return {
        id: resultSet.getLong("id"),
        personnel_uid: resultSet.getString("personnel_uid"),
        attendance_date: String(resultSet.getDate("attendance_date")),
        full_name: resultSet.getString("full_name"),
        rank: resultSet.getString("rank"),
        camp: resultSet.getString("camp"),
        office: resultSet.getString("office"),
        status: resultSet.getString("status"),
        remarks: resultSet.getString("remarks"),
        created_by: resultSet.getString("created_by"),
        created_at: String(resultSet.getTimestamp("created_at"))
      };
    } finally {
      this.closeQuietly_(resultSet);
      this.closeQuietly_(statement);
      this.closeQuietly_(connection);
    }
  },

  // Phase 2.2 public write method. Multiple rows are currently inserted one at
  // a time; Phase 2.3 will replace this with one transaction/batch operation.
  insertAttendance(rows) {
    const payload = Array.isArray(rows) ? rows : [rows];
    if (!payload.length) return [];
    return payload.map(row => this.insertAttendanceJdbc(row));
  },

  getAttendanceJdbc(filters) {
    const params = filters || {};
    const clauses = [];
    const values = [];

    if (params.attendanceDate) {
      clauses.push("attendance_date = CAST(? AS DATE)");
      values.push(String(params.attendanceDate));
    }
    if (params.camp) {
      clauses.push("camp = ?");
      values.push(String(params.camp));
    }
    if (params.office) {
      clauses.push("office = ?");
      values.push(String(params.office));
    }

    const sql = [
      "SELECT id, personnel_uid, attendance_date, full_name, rank, camp,",
      "office, status, remarks, created_by, created_at, updated_by, updated_at",
      "FROM public.attendance",
      clauses.length ? "WHERE " + clauses.join(" AND ") : "",
      "ORDER BY attendance_date DESC, full_name ASC"
    ].filter(Boolean).join(" ");

    let connection;
    let statement;
    let resultSet;
    const rows = [];

    try {
      connection = this.openJdbcConnection_();
      statement = connection.prepareStatement(sql);
      values.forEach((value, index) => statement.setString(index + 1, value));
      resultSet = statement.executeQuery();

      while (resultSet.next()) {
        const updatedAt = resultSet.getTimestamp("updated_at");
        rows.push({
          id: resultSet.getLong("id"),
          personnel_uid: resultSet.getString("personnel_uid"),
          attendance_date: String(resultSet.getDate("attendance_date")),
          full_name: resultSet.getString("full_name"),
          rank: resultSet.getString("rank"),
          camp: resultSet.getString("camp"),
          office: resultSet.getString("office"),
          status: resultSet.getString("status"),
          remarks: resultSet.getString("remarks"),
          created_by: resultSet.getString("created_by"),
          created_at: String(resultSet.getTimestamp("created_at")),
          updated_by: resultSet.getString("updated_by"),
          updated_at: updatedAt ? String(updatedAt) : null
        });
      }

      return rows;
    } finally {
      this.closeQuietly_(resultSet);
      this.closeQuietly_(statement);
      this.closeQuietly_(connection);
    }
  },

  getAttendance(filters) {
    return this.getAttendanceJdbc(filters || {});
  },

  getAttendanceAuditByAttendanceIdJdbc(attendanceId) {
    const sql = [
      "SELECT audit_id, attendance_id, action, personnel_uid,",
      "attendance_date, new_full_name, new_office, new_status,",
      "changed_by, changed_at",
      "FROM public.attendance_audit",
      "WHERE attendance_id = ?",
      "ORDER BY audit_id DESC",
      "LIMIT 1"
    ].join(" ");

    let connection;
    let statement;
    let resultSet;

    try {
      connection = this.openJdbcConnection_();
      statement = connection.prepareStatement(sql);
      statement.setLong(1, Number(attendanceId));
      resultSet = statement.executeQuery();

      if (!resultSet.next()) return null;

      return {
        audit_id: resultSet.getLong("audit_id"),
        attendance_id: resultSet.getLong("attendance_id"),
        action: resultSet.getString("action"),
        personnel_uid: resultSet.getString("personnel_uid"),
        attendance_date: String(resultSet.getDate("attendance_date")),
        full_name: resultSet.getString("new_full_name"),
        office: resultSet.getString("new_office"),
        status: resultSet.getString("new_status"),
        changed_by: resultSet.getString("changed_by"),
        changed_at: String(resultSet.getTimestamp("changed_at"))
      };
    } finally {
      this.closeQuietly_(resultSet);
      this.closeQuietly_(statement);
      this.closeQuietly_(connection);
    }
  },

  // Temporary Data API helper retained for rollback/testing only.
  request_(path, options) {
    const config = this.getConfig_();
    const cleanPath = String(path || "").replace(/^\/+/, "");
    const headers = Object.assign(
      { Accept: "application/json" },
      options && options.headers ? options.headers : {}
    );

    if (config.token) headers.Authorization = "Bearer " + config.token;

    const requestOptions = Object.assign(
      {
        method: "get",
        muteHttpExceptions: true,
        contentType: "application/json",
        headers
      },
      options || {},
      { headers }
    );

    const response = UrlFetchApp.fetch(
      config.apiUrl + "/" + cleanPath,
      requestOptions
    );
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    const body = ServerUtils.parseJsonSafely(responseText);

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(
        "Neon Data API request failed (" + statusCode + "): " +
        (typeof body === "string" ? body : JSON.stringify(body))
      );
    }

    return body;
  }
});

function testNeonConnection() {
  return NeonService.testJdbcConnection();
}

function testInsertAttendanceViaJdbc() {
  const now = new Date();
  const suffix = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss"
  );
  const attendanceDate = Utilities.formatDate(
    now,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
  const email = Session.getActiveUser().getEmail() || "apps-script-test";

  const inserted = NeonService.insertAttendanceJdbc({
    personnel_uid: "PHASE2-JDBC-" + suffix,
    attendance_date: attendanceDate,
    full_name: "Alvin Chiao",
    rank: "CO1",
    camp: "NBP",
    office: "CASO",
    status: "PRESENT",
    remarks: "Phase 2.1 JDBC insert test",
    created_by: email
  });

  const audit = NeonService.getAttendanceAuditByAttendanceIdJdbc(inserted.id);
  const result = {
    success: true,
    message: "Attendance row inserted through JDBC.",
    attendance: inserted,
    audit,
    auditVerified: Boolean(audit && audit.action === "INSERT")
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}
