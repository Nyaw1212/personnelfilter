//----------------------------------
// AOGEN reassignment bridge performance timing
//----------------------------------

function sendStage1ReassignmentToAogen(payload) {
  const startedAt = Date.now();
  const timing = {
    totalMs: 0,
    normalizeMs: 0,
    validateMs: 0,
    propertiesMs: 0,
    requestBuildMs: 0,
    fetchMs: 0,
    responseReadMs: 0,
    parseMs: 0,
    normalizeResultMs: 0,
    logReportMs: 0,
    personnel: 0,
    requestBytes: 0,
    responseBytes: 0,
    statusCode: 0,
  };

  try {
    const source = payload && typeof payload === "object" ? payload : {};

    const normalizeStartedAt = Date.now();
    const normalizedPayload = normalizeBridgePayload_(source);
    normalizedPayload.saveMode = cleanBridgeValue_(source.saveMode) || "NEW";
    normalizedPayload.sourceDocumentId = cleanBridgeValue_(source.sourceDocumentId);
    normalizedPayload.sourceReportUrl = cleanBridgeValue_(source.sourceReportUrl);
    normalizedPayload.internalRevision = Number(source.internalRevision || 0);
    normalizedPayload.baseOrderNumber = cleanBridgeValue_(
      source.baseOrderNumber || normalizedPayload.orderNumber
    );
    timing.normalizeMs = Date.now() - normalizeStartedAt;
    timing.personnel = Array.isArray(normalizedPayload.personnel)
      ? normalizedPayload.personnel.length
      : 0;

    const validateStartedAt = Date.now();
    const validationWarnings = validateBridgePayload_(normalizedPayload);
    timing.validateMs = Date.now() - validateStartedAt;

    const propertiesStartedAt = Date.now();
    const properties = PropertiesService.getScriptProperties();
    const endpoint = cleanBridgeValue_(
      properties.getProperty(REASSIGNMENT_BRIDGE_CONFIG.endpointProperty)
    );
    const apiKey = cleanBridgeValue_(
      properties.getProperty(REASSIGNMENT_BRIDGE_CONFIG.apiKeyProperty)
    );
    timing.propertiesMs = Date.now() - propertiesStartedAt;

    if (!endpoint) {
      throw new Error(
        "AOGEN_REASSIGNMENT_ENDPOINT is not configured in Script Properties."
      );
    }
    if (!apiKey) {
      throw new Error("REASSIGNMENT_API_KEY is not configured in Script Properties.");
    }

    const requestBuildStartedAt = Date.now();
    const action = normalizedPayload.saveMode === "UPDATE_EXISTING"
      ? "UPDATE_REASSIGNMENT"
      : "GENERATE_REASSIGNMENT";
    const requestPayload = JSON.stringify({
      action,
      apiKey,
      payload: normalizedPayload,
    });
    timing.requestBytes = requestPayload.length;
    timing.requestBuildMs = Date.now() - requestBuildStartedAt;

    const fetchStartedAt = Date.now();
    const response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      payload: requestPayload,
      muteHttpExceptions: true,
      followRedirects: true,
    });
    timing.fetchMs = Date.now() - fetchStartedAt;

    const responseReadStartedAt = Date.now();
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    timing.statusCode = statusCode;
    timing.responseBytes = responseText.length;
    timing.responseReadMs = Date.now() - responseReadStartedAt;

    const parseStartedAt = Date.now();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (error) {
      throw new Error(
        "AOGENup returned a non-JSON response. HTTP " + statusCode +
        ". Response: " + responseText.slice(0, 300)
      );
    }
    timing.parseMs = Date.now() - parseStartedAt;

    if (
      statusCode < 200 ||
      statusCode >= 300 ||
      !result ||
      result.success !== true
    ) {
      throw new Error(
        (result && result.message) ||
        "AOGENup could not save the reassignment report."
      );
    }

    const normalizeResultStartedAt = Date.now();
    const normalizedResult = {
      success: true,
      message: result.message || (
        normalizedPayload.saveMode === "UPDATE_EXISTING"
          ? "Existing report updated successfully."
          : "Reassignment report generated successfully."
      ),
      documentId: cleanBridgeValue_(
        result.documentId || normalizedPayload.sourceDocumentId
      ),
      url: cleanBridgeValue_(result.url || normalizedPayload.sourceReportUrl),
      outputName: cleanBridgeValue_(result.outputName),
      personnelCount: Number(
        result.personnelCount || normalizedPayload.personnel.length || 0
      ),
      saveMode: normalizedPayload.saveMode,
      internalRevision: normalizedPayload.internalRevision,
      orderNumber: normalizedPayload.orderNumber,
      validationWarnings,
      caution: validationWarnings.length
        ? "Report generated with incomplete details."
        : "",
      aogenTiming: result.timing || null,
      timing,
    };
    timing.normalizeResultMs = Date.now() - normalizeResultStartedAt;

    const logStartedAt = Date.now();
    try {
      logGeneratedReport_(normalizedPayload, normalizedResult);
    } catch (logError) {
      console.error("Generated report logging failed:", logError);
      normalizedResult.logWarning =
        "The report was saved, but its history summary could not be updated.";
    }
    timing.logReportMs = Date.now() - logStartedAt;

    return normalizedResult;
  } catch (error) {
    console.error("sendStage1ReassignmentToAogen error:", error);
    return {
      success: false,
      message: getBridgeErrorMessage_(error),
      timing,
    };
  } finally {
    timing.totalMs = Date.now() - startedAt;
    console.log(
      "[PERF][AOGEN Bridge] total=%sms personnel=%s normalize=%sms validate=%sms properties=%sms requestBuild=%sms fetch=%sms responseRead=%sms parse=%sms normalizeResult=%sms logReport=%sms requestBytes=%s responseBytes=%s status=%s",
      timing.totalMs,
      timing.personnel,
      timing.normalizeMs,
      timing.validateMs,
      timing.propertiesMs,
      timing.requestBuildMs,
      timing.fetchMs,
      timing.responseReadMs,
      timing.parseMs,
      timing.normalizeResultMs,
      timing.logReportMs,
      timing.requestBytes,
      timing.responseBytes,
      timing.statusCode
    );
  }
}
