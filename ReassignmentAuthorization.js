//----------------------------------
// Reassignment Bridge Authorization
//----------------------------------

/**
 * Run this function once from the Personnel Filter Apps Script editor.
 * It forces Apps Script to request the external-request OAuth scope that
 * UrlFetchApp needs before the deployed web app can call AOGENup.
 */
function authorizeReassignmentBridge() {
  const properties = PropertiesService.getScriptProperties();
  const endpoint = String(
    properties.getProperty("AOGEN_REASSIGNMENT_ENDPOINT") || ""
  ).trim();

  if (!endpoint) {
    throw new Error(
      "AOGEN_REASSIGNMENT_ENDPOINT is not configured in this Personnel Filter project."
    );
  }

  const response = UrlFetchApp.fetch(endpoint, {
    method: "get",
    muteHttpExceptions: true,
    followRedirects: true,
  });

  const result = {
    authorized: true,
    responseCode: response.getResponseCode(),
    message:
      "UrlFetchApp authorization completed. You may now use Generate Report.",
  };

  console.log(JSON.stringify(result));
  return result;
}
