// ==================================
// Neon Data API service
// ==================================
// This file is the only layer that should know Neon HTTP details.

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
