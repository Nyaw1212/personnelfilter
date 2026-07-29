//----------------------------------
// Personnel Spreadsheet Menu
//----------------------------------

const PERSONNEL_WEB_APP_URL_PROPERTY = "PERSONNEL_WEBAPP_URL";

function onOpen() {
  SpreadsheetApp
    .getUi()
    .createMenu("Personnel")
    .addItem("Open Personnel Web App", "openPersonnelWebApp")
    .addSeparator()
    .addItem("Open Personnel Panel", "openPersonnelPanel")
    .addItem("Open Summary Report", "openPersonnelSummaryReport")
    .addSeparator()
    .addItem("Show All Personnel", "showAllPersonnel")
    .addToUi();
}

function openPersonnelWebApp() {
  const url = getPersonnelWebAppUrl_();

  if (!url) {
    SpreadsheetApp.getUi().alert(
      "Personnel Web App",
      "PERSONNEL_WEBAPP_URL is not configured. Add the deployed Personnel Filter /exec URL in Project Settings → Script Properties.",
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  const safeUrl = escapePersonnelMenuHtml_(url);
  const html = HtmlService
    .createHtmlOutput(`
      <!doctype html>
      <html>
        <head>
          <base target="_blank">
          <style>
            body {
              margin: 0;
              padding: 22px;
              font-family: Arial, sans-serif;
              color: #173d23;
              background: #f5fbf6;
            }
            h2 { margin: 0 0 8px; }
            p { margin: 0 0 16px; color: #52685a; }
            .url {
              padding: 11px;
              border: 1px solid #cfe0d3;
              border-radius: 10px;
              background: #fff;
              overflow-wrap: anywhere;
              font-size: 12px;
            }
            .actions {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              margin-top: 18px;
            }
            button, a {
              min-height: 38px;
              padding: 9px 14px;
              border-radius: 11px;
              font: inherit;
              font-weight: 700;
              text-decoration: none;
              cursor: pointer;
            }
            button {
              border: 1px solid #cfe0d3;
              background: #fff;
              color: #173d23;
            }
            a {
              display: inline-flex;
              align-items: center;
              border: 1px solid #e2c900;
              background: #ffe500;
              color: #173d23;
            }
          </style>
        </head>
        <body>
          <h2>Personnel Filter Web App</h2>
          <p>Open the deployed Personnel Filter in a new browser tab.</p>
          <div class="url">${safeUrl}</div>
          <div class="actions">
            <button onclick="google.script.host.close()">Close</button>
            <a href="${safeUrl}" onclick="setTimeout(() => google.script.host.close(), 250)">Open Web App</a>
          </div>
        </body>
      </html>
    `)
    .setWidth(520)
    .setHeight(260);

  SpreadsheetApp.getUi().showModalDialog(html, "Personnel Web App");
}

function getPersonnelWebAppUrl_() {
  const configuredUrl = String(
    PropertiesService.getScriptProperties().getProperty(
      PERSONNEL_WEB_APP_URL_PROPERTY
    ) || ""
  ).trim();

  if (isValidPersonnelWebAppUrl_(configuredUrl)) {
    return configuredUrl;
  }

  const serviceUrl = String(ScriptApp.getService().getUrl() || "").trim();
  return isValidPersonnelWebAppUrl_(serviceUrl) ? serviceUrl : "";
}

function isValidPersonnelWebAppUrl_(value) {
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:[?#].*)?$/i.test(
    String(value || "").trim()
  );
}

function checkWebAppUrl() {
  const configured = PropertiesService
    .getScriptProperties()
    .getProperty(PERSONNEL_WEB_APP_URL_PROPERTY);

  const resolved = getPersonnelWebAppUrl_();

  console.log("Configured PERSONNEL_WEBAPP_URL:", configured || null);
  console.log("Resolved Personnel Web App URL:", resolved || null);

  return {
    configured: configured || "",
    resolved,
    valid: Boolean(resolved),
  };
}

function escapePersonnelMenuHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
