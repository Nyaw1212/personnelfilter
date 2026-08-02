// ==================================
// Neon database service
// ==================================
// This file contains both the existing Neon Data API client and a small
// JDBC proof-of-connection. The JDBC test is intentionally isolated so the
// current attendance code continues using the Data API until connectivity is
// confirmed.

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
    const host = ServerUtils.normalizeText(
      properties.getProperty("NEON_HOST")
    );
    const database = ServerUtils.normalizeText(
      properties.getProperty("NEON_DATABASE")
    );
    const user = ServerUtils.normalizeText(
      properties.getProperty("NEON_USER")
    );
    const password = String(
      properties.getProperty("NEON_PASSWORD") || ""
    );
    const port = ServerUtils.normalizeText(
      properties.getProperty("NEON_PORT")
    ) || "5432";

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

  openJdbcConnection_() {
    const config = this.getJdbcConfig_();
    return Jdbc.getConnection(
      config.jdbcUrl,
      config.user,
      config.password
    );
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
      const message = error && error.message
        ? error.message
        : String(error);

      console.error("Neon JDBC connection failed: " + message);
      throw new Error("Neon JDBC connection failed: " + message);
    } finally {
      if (connection) {
        try {
          connection.close();
        } catch (closeError) {
          console.warn(
            "Neon JDBC connection close warning: " +
            (closeError && closeError.message
              ? closeError.message
              : String(closeError))
          );
        }
      }
    }
  },

  request_(path, options) {
    const config = this.getConfig_();
    const cleanPath = String(path || "").replace(/^\/+/, "");
    const headers = Object.assign(
      { Accept: "application/json" },
      options && options.headers ? options.headers : {}
    );

    if (config.token) {
      headers.Authorization = "Bearer " + config.token;
    }

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
  },

  insertAttendance(rows) {
    const payload = Array.isArray(rows) ? rows : [rows];
    if (!payload.length) return [];

    return this.request_(APP_CONFIG.NEON.ATTENDANCE_TABLE, {
      method: "post",
      headers: { Prefer: "return=representation" },
      payload: JSON.stringify(payload)
    });
  },

  getAttendance(filters) {
    const params = filters || {};
    const query = ["select=*"];

    if (params.attendanceDate) {
      query.push(
        "attendance_date=eq." + encodeURIComponent(params.attendanceDate)
      );
    }
    if (params.camp) {
      query.push("camp=eq." + encodeURIComponent(params.camp));
    }
    if (params.office) {
      query.push("office=eq." + encodeURIComponent(params.office));
    }

    query.push("order=attendance_date.desc,full_name.asc");

    return this.request_(
      APP_CONFIG.NEON.ATTENDANCE_TABLE + "?" + query.join("&")
    );
  }
});

// Run manually from the Apps Script editor.
function testNeonConnection() {
  return NeonService.testJdbcConnection();
}
