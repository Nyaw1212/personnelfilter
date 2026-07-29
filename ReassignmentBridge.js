//----------------------------------
// Reassignment Bridge
// Personnel Filter -> AOGENup
//----------------------------------

const REASSIGNMENT_BRIDGE_CONFIG = Object.freeze({
  endpointProperty: "AOGEN_REASSIGNMENT_ENDPOINT",
  apiKeyProperty: "REASSIGNMENT_API_KEY",
  action: "GENERATE_REASSIGNMENT",
  timeoutMs: 30000,
});

/**
 * Sends a completed reassignment payload to the deployed AOGENup web app.
 * This function is called from the Personnel Filter browser through
 * google.script.run.
 *
 * @param {Object} payload Reassignment order details and personnel rows.
 * @return {Object} A normalized success/error response.
 */
function sendReassignmentToAogen(payload) {
  try {
    const normalizedPayload = normalizeBridgePayload_(payload);
    validateBridgePayload_(normalizedPayload);

    const properties = PropertiesService.getScriptProperties();

    const endpoint = cleanBridgeValue_(
      properties.getProperty(
        REASSIGNMENT_BRIDGE_CONFIG.endpointProperty
      )
    );

    const apiKey = cleanBridgeValue_(
      properties.getProperty(
        REASSIGNMENT_BRIDGE_CONFIG.apiKeyProperty
      )
    );

    if (!endpoint) {
      throw new Error(
        "AOGEN_REASSIGNMENT_ENDPOINT is not configured in Personnel Filter Script Properties."
      );
    }

    if (!apiKey) {
      throw new Error(
        "REASSIGNMENT_API_KEY is not configured in Personnel Filter Script Properties."
      );
    }

    const requestBody = {
      action: REASSIGNMENT_BRIDGE_CONFIG.action,
      apiKey,
      payload: normalizedPayload,
    };

    const response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(requestBody),
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
        "AOGENup returned a non-JSON response. HTTP " +
          statusCode +
          ". Response: " +
          responseText.slice(0, 300)
      );
    }

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(
        result.message ||
          "AOGENup request failed with HTTP " + statusCode + "."
      );
    }

    if (!result || result.success !== true) {
      throw new Error(
        result && result.message
          ? result.message
          : "AOGENup could not generate the reassignment report."
      );
    }

    return {
      success: true,
      message:
        result.message ||
        "Reassignment Report generated successfully.",
      documentId: cleanBridgeValue_(result.documentId),
      url: cleanBridgeValue_(result.url),
      outputName: cleanBridgeValue_(result.outputName),
      personnelCount: Number(result.personnelCount || 0),
    };
  } catch (error) {
    console.error("sendReassignmentToAogen error:", error);

    return {
      success: false,
      message: getBridgeErrorMessage_(error),
    };
  }
}

function normalizeBridgePayload_(payload) {
  const source =
    payload && typeof payload === "object"
      ? payload
      : {};

  const personnel = Array.isArray(source.personnel)
    ? source.personnel
    : [];

  return {
    orderNumber: cleanBridgeValue_(source.orderNumber),
    orderDate: source.orderDate || "",
    signingOfficer: cleanBridgeValue_(source.signingOfficer),
    signingPosition: cleanBridgeValue_(source.signingPosition),
    fileReference: cleanBridgeValue_(source.fileReference),
    personnel: personnel.map((person) => ({
      rank: cleanBridgeValue_(person && person.rank),
      fullName: cleanBridgeValue_(person && person.fullName),
      from: cleanBridgeValue_(person && person.from),
      to: cleanBridgeValue_(person && person.to),
      notes: cleanBridgeValue_(person && person.notes),
    })),
  };
}

function validateBridgePayload_(payload) {
  const missing = [];

  if (!payload.orderNumber) missing.push("Order Number");
  if (!payload.orderDate) missing.push("Order Date");
  if (!payload.signingOfficer) missing.push("Signing Officer");
  if (!payload.signingPosition) missing.push("Signing Position");

  if (missing.length) {
    throw new Error(
      "Complete the following reassignment fields:\n\n" +
        missing.join("\n")
    );
  }

  if (!payload.personnel.length) {
    throw new Error(
      "Assign at least one personnel before generating the report."
    );
  }

  payload.personnel.forEach((person, index) => {
    const rowMissing = [];

    if (!person.rank) rowMissing.push("Rank");
    if (!person.fullName) rowMissing.push("Full Name");
    if (!person.from) rowMissing.push("From");
    if (!person.to) rowMissing.push("To");

    if (rowMissing.length) {
      throw new Error(
        "Personnel item " +
          (index + 1) +
          " is missing: " +
          rowMissing.join(", ")
      );
    }
  });
}

function cleanBridgeValue_(value) {
  return String(
    value === null || value === undefined
      ? ""
      : value
  ).trim();
}

function getBridgeErrorMessage_(error) {
  if (!error) return "Unknown reassignment bridge error.";
  return error.message || String(error);
}

//----------------------------------
// Optional manual connection test
//----------------------------------

function testReassignmentBridgeConnection() {
  const properties = PropertiesService.getScriptProperties();

  return {
    endpointConfigured: Boolean(
      properties.getProperty(
        REASSIGNMENT_BRIDGE_CONFIG.endpointProperty
      )
    ),
    apiKeyConfigured: Boolean(
      properties.getProperty(
        REASSIGNMENT_BRIDGE_CONFIG.apiKeyProperty
      )
    ),
  };
}
