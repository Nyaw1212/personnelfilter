// ==================================
// Reusable Neon JSON engine
// ==================================
// Standard PostgreSQL access pattern for Apps Script:
//   READ  -> PostgreSQL aggregates rows to one JSON value.
//   WRITE -> Apps Script sends one JSON payload for PostgreSQL to expand.
// This avoids slow row-by-row JDBC getter and setter calls.

const NeonJsonEngine = Object.freeze({
  bindValue_(statement, parameterIndex, value) {
    if (value === null || value === undefined) {
      statement.setNull(parameterIndex, Jdbc.TYPE_VARCHAR);
      return;
    }

    if (value instanceof Date) {
      statement.setString(
        parameterIndex,
        Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss")
      );
      return;
    }

    if (typeof value === "boolean") {
      statement.setBoolean(parameterIndex, value);
      return;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      statement.setDouble(parameterIndex, value);
      return;
    }

    statement.setString(parameterIndex, String(value));
  },

  bindParams_(statement, params, startIndex) {
    const values = Array.isArray(params) ? params : [];
    const startedAt = Date.now();
    let parameterIndex = Number(startIndex) || 1;

    values.forEach(value => {
      this.bindValue_(statement, parameterIndex++, value);
    });

    return {
      nextIndex: parameterIndex,
      elapsedMs: Date.now() - startedAt
    };
  },

  queryJson(options) {
    const config = options || {};
    const name = ServerUtils.normalizeText(config.name) || "UnnamedQuery";
    const sql = String(config.sql || "").trim();
    const params = Array.isArray(config.params) ? config.params : [];

    if (!sql) throw new Error("NeonJsonEngine.queryJson requires SQL.");

    const timing = {
      connectMs: 0,
      prepareMs: 0,
      bindMs: 0,
      executeMs: 0,
      readPayloadMs: 0,
      parseJsonMs: 0,
      cleanupMs: 0,
      totalMs: 0,
      payloadChars: 0
    };
    const startedAt = Date.now();

    let connection;
    let statement;
    let resultSet;
    let data = config.defaultValue === undefined ? [] : config.defaultValue;

    try {
      const connectStartedAt = Date.now();
      connection = NeonService.openJdbcConnection_();
      timing.connectMs = Date.now() - connectStartedAt;

      const prepareStartedAt = Date.now();
      statement = connection.prepareStatement(sql);
      timing.prepareMs = Date.now() - prepareStartedAt;

      timing.bindMs = this.bindParams_(statement, params, 1).elapsedMs;

      const executeStartedAt = Date.now();
      resultSet = statement.executeQuery();
      timing.executeMs = Date.now() - executeStartedAt;

      const readStartedAt = Date.now();
      let payloadText = "";
      if (resultSet.next()) {
        payloadText = String(resultSet.getString(1) || "");
      }
      timing.readPayloadMs = Date.now() - readStartedAt;
      timing.payloadChars = payloadText.length;

      if (payloadText) {
        const parseStartedAt = Date.now();
        data = JSON.parse(payloadText);
        timing.parseJsonMs = Date.now() - parseStartedAt;
      }

      return { data, timing };
    } catch (error) {
      throw new Error(
        "Neon JSON query failed [" + name + "]: " +
        (error && error.message ? error.message : String(error))
      );
    } finally {
      const cleanupStartedAt = Date.now();
      NeonService.closeQuietly_(resultSet);
      NeonService.closeQuietly_(statement);
      NeonService.closeQuietly_(connection);
      timing.cleanupMs = Date.now() - cleanupStartedAt;
      timing.totalMs = Date.now() - startedAt;

      console.log(
        "[PERF][NeonJsonEngine][QUERY][%s] total=%sms connect=%sms prepare=%sms bind=%sms execute=%sms readPayload=%sms parseJson=%sms cleanup=%sms payloadChars=%s params=%s",
        name,
        timing.totalMs,
        timing.connectMs,
        timing.prepareMs,
        timing.bindMs,
        timing.executeMs,
        timing.readPayloadMs,
        timing.parseJsonMs,
        timing.cleanupMs,
        timing.payloadChars,
        params.length
      );
    }
  },

  executeJson(options) {
    const config = options || {};
    const name = ServerUtils.normalizeText(config.name) || "UnnamedCommand";
    const sql = String(config.sql || "").trim();
    const payload = config.payload === undefined ? [] : config.payload;
    const params = Array.isArray(config.params) ? config.params : [];
    const useTransaction = config.useTransaction !== false;

    if (!sql) throw new Error("NeonJsonEngine.executeJson requires SQL.");

    const timing = {
      jsonBuildMs: 0,
      connectMs: 0,
      transactionSetupMs: 0,
      prepareMs: 0,
      bindMs: 0,
      executeMs: 0,
      commitMs: 0,
      cleanupMs: 0,
      totalMs: 0,
      payloadChars: 0,
      affectedRows: 0
    };
    const startedAt = Date.now();

    const jsonStartedAt = Date.now();
    const jsonPayload = JSON.stringify(payload);
    timing.jsonBuildMs = Date.now() - jsonStartedAt;
    timing.payloadChars = jsonPayload.length;

    let connection;
    let statement;

    try {
      const connectStartedAt = Date.now();
      connection = NeonService.openJdbcConnection_();
      timing.connectMs = Date.now() - connectStartedAt;

      if (useTransaction) {
        const transactionStartedAt = Date.now();
        connection.setAutoCommit(false);
        timing.transactionSetupMs = Date.now() - transactionStartedAt;
      }

      const prepareStartedAt = Date.now();
      statement = connection.prepareStatement(sql);
      timing.prepareMs = Date.now() - prepareStartedAt;

      const bindStartedAt = Date.now();
      statement.setString(1, jsonPayload);
      this.bindParams_(statement, params, 2);
      timing.bindMs = Date.now() - bindStartedAt;

      const executeStartedAt = Date.now();
      timing.affectedRows = statement.executeUpdate();
      timing.executeMs = Date.now() - executeStartedAt;

      if (useTransaction) {
        const commitStartedAt = Date.now();
        connection.commit();
        timing.commitMs = Date.now() - commitStartedAt;
      }

      return {
        success: true,
        affectedRows: timing.affectedRows,
        timing
      };
    } catch (error) {
      if (connection && useTransaction) {
        try {
          connection.rollback();
        } catch (rollbackError) {
          console.error(
            "Neon JSON rollback failed [" + name + "]: " +
            (rollbackError && rollbackError.message
              ? rollbackError.message
              : String(rollbackError))
          );
        }
      }

      throw new Error(
        "Neon JSON command failed [" + name + "]: " +
        (error && error.message ? error.message : String(error))
      );
    } finally {
      const cleanupStartedAt = Date.now();
      NeonService.closeQuietly_(statement);
      if (connection && useTransaction) {
        try {
          connection.setAutoCommit(true);
        } catch (ignore) {}
      }
      NeonService.closeQuietly_(connection);
      timing.cleanupMs = Date.now() - cleanupStartedAt;
      timing.totalMs = Date.now() - startedAt;

      console.log(
        "[PERF][NeonJsonEngine][COMMAND][%s] total=%sms jsonBuild=%sms connect=%sms txSetup=%sms prepare=%sms bind=%sms execute=%sms commit=%sms cleanup=%sms payloadChars=%s params=%s affected=%s",
        name,
        timing.totalMs,
        timing.jsonBuildMs,
        timing.connectMs,
        timing.transactionSetupMs,
        timing.prepareMs,
        timing.bindMs,
        timing.executeMs,
        timing.commitMs,
        timing.cleanupMs,
        timing.payloadChars,
        params.length,
        timing.affectedRows
      );
    }
  }
});
