const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const projectRoot = path.resolve(__dirname, "..");
const scriptFiles = [
  "Stage1ReportLauncherAndEscapeJS.html",
  "ReassignmentNewReportResetFixJS.html",
];

const dom = new JSDOM(`<!doctype html>
<html><body>
  <button id="openReportGeneratorButton">Report Generator</button>
  <div id="stage1MainReportChoiceBackdrop" hidden></div>
  <section id="stage1MainReportChoiceDialog" hidden></section>
  <div id="reportTypeBackdrop" hidden></div>
  <section id="reportTypeDialog" hidden></section>
  <section id="reassignmentWorkspace" hidden></section>
  <span id="aoCartCount">2 selected</span>
  <table><tbody id="previewTableBody"></tbody></table>
</body></html>`, {
  runScripts: "outside-only",
  url: "http://localhost",
});

const { window } = dom;
const { document } = window;

window.PersonnelState = {
  aoCart: new Map([
    ["row:1", { fullName: "PERSON ONE" }],
    ["row:2", { fullName: "PERSON TWO" }],
  ]),
};

window.ReassignmentState = {
  activeOffice: "ESCORT",
  activeCamp: "NBP",
  assignments: new Map([["row:1", "EAS"]]),
  selectedKeys: new Set(["row:2"]),
  filters: {
    search: "person",
    rank: "CO1",
    office: "ESCORT",
    camp: "NBP",
  },
};

window.Stage1ReportEditorState = {
  loading: false,
  sourceReport: { orderNumber: "OLD-REPORT" },
};

let reportTypeOpened = false;
window.saveAoCart_ = () => {
  window.localStorage.setItem(
    "personnelFilterAoCartV1",
    JSON.stringify([...window.PersonnelState.aoCart.entries()])
  );
};
window.saveReassignmentState_ = () => {};
window.updateAoCartCount_ = () => {
  document.getElementById("aoCartCount").textContent =
    `${window.PersonnelState.aoCart.size} selected`;
};
window.updateReportGeneratorButton_ = () => {};
window.renderPreviewTable = () => {};
window.openReportTypeDialog_ = () => {
  reportTypeOpened = true;
  document.getElementById("reportTypeBackdrop").hidden = false;
  document.getElementById("reportTypeDialog").hidden = false;
};
window.closeReportTypeDialog_ = () => {};

window.localStorage.setItem(
  "personnelFilterAoCartV1",
  JSON.stringify([...window.PersonnelState.aoCart.entries()])
);

for (const file of scriptFiles) {
  const source = fs.readFileSync(path.join(projectRoot, file), "utf8");
  window.eval(source);
}

document.dispatchEvent(new window.Event("DOMContentLoaded", { bubbles: true }));

document.getElementById("openReportGeneratorButton").click();

const launcher = document.getElementById("stage1MainReportChoiceDialog");
assert.equal(launcher.hidden, false, "Report Generator should open the session dialog.");

const newReportButton = launcher.querySelector("button[data-action='NEW']");
assert.ok(newReportButton, "New Report button should exist.");

newReportButton.click();

assert.equal(window.PersonnelState.aoCart.size, 2,
  "New Report should keep the personnel currently selected in the main table.");
assert.equal(window.ReassignmentState.assignments.size, 0,
  "New Report should clear old Step 3 assignments.");
assert.equal(window.ReassignmentState.selectedKeys.size, 0,
  "New Report should clear old workspace checkbox selections.");
assert.equal(window.Stage1ReportEditorState.sourceReport, null,
  "New Report should exit old generated-report edit mode.");
assert.equal(reportTypeOpened, true,
  "New Report should open the report type picker.");
assert.equal(document.getElementById("reportTypeDialog").hidden, false,
  "The report type dialog should be visible.");
assert.equal(document.getElementById("aoCartCount").textContent, "2 selected",
  "Toolbar count should continue showing the current selected personnel.");

console.log("✓ Report Generator New Report picker flow passed");
