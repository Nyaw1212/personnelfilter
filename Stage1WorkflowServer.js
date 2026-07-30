//----------------------------------
// Stage 1 Upgrade: Report Save Bridge
//----------------------------------

function sendStage1ReassignmentToAogen(payload) {
  try {
    const source = payload && typeof payload === "object" ? payload : {};
    const normalizedPayload = normalizeBridgePayload_(source);
    validateBridgePayload_(normalizedPayload);

    normalizedPayload.saveMode = cleanBridgeValue_(source.saveMode) || "NEW";
    normalizedPayload.sourceDocumentId = cleanBridgeValue_(source.sourceDocumentId);
    normalizedPayload.sourceReportUrl = cleanBridgeValue_(source.sourceReportUrl);
    normalizedPayload.internalRevision = Number(source.internalRevision || 0);
    normalizedPayload.baseOrderNumber = cleanBridgeValue_(source.baseOrderNumber || normalizedPayload.orderNumber);

    const properties = PropertiesService.getScriptProperties();
    const endpoint = cleanBridgeValue_(
      properties.getProperty(REASSIGNMENT_BRIDGE_CONFIG.endpointProperty)
    );
    const apiKey = cleanBridgeValue_(
      properties.getProperty(REASSIGNMENT_BRIDGE_CONFIG.apiKeyProperty)
    );

    if (!endpoint) {
      throw new Error("AOGEN_REASSIGNMENT_ENDPOINT is not configured in Script Properties.");
    }
    if (!apiKey) {
      throw new Error("REASSIGNMENT_API_KEY is not configured in Script Properties.");
    }

    const action = normalizedPayload.saveMode === "UPDATE_EXISTING"
      ? "UPDATE_REASSIGNMENT"
      : "GENERATE_REASSIGNMENT";

    const response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ action, apiKey, payload: normalizedPayload }),
      muteHttpExceptions: true,
      followRedirects: true,
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    let result;

    try {
      result = JSON.parse(responseText);
    } catch (error) {
      throw new Error(
        "AOGENup returned a non-JSON response. HTTP " + statusCode +
        ". Response: " + responseText.slice(0, 300)
      );
    }

    if (statusCode < 200 || statusCode >= 300 || !result || result.success !== true) {
      throw new Error(result?.message || "AOGENup could not save the reassignment report.");
    }

    const normalizedResult = {
      success: true,
      message: result.message || (
        normalizedPayload.saveMode === "UPDATE_EXISTING"
          ? "Existing report updated successfully."
          : "Reassignment report generated successfully."
      ),
      documentId: cleanBridgeValue_(result.documentId || normalizedPayload.sourceDocumentId),
      url: cleanBridgeValue_(result.url || normalizedPayload.sourceReportUrl),
      outputName: cleanBridgeValue_(result.outputName),
      personnelCount: Number(result.personnelCount || normalizedPayload.personnel.length || 0),
      saveMode: normalizedPayload.saveMode,
      internalRevision: normalizedPayload.internalRevision,
      orderNumber: normalizedPayload.orderNumber,
    };

    try {
      logGeneratedReport_(normalizedPayload, normalizedResult);
    } catch (logError) {
      console.error("Generated report logging failed:", logError);
      normalizedResult.logWarning = "The report was saved, but its history summary could not be updated.";
    }

    return normalizedResult;
  } catch (error) {
    console.error("sendStage1ReassignmentToAogen error:", error);
    return {
      success: false,
      message: getBridgeErrorMessage_(error),
    };
  }
}
