// ----------------------------------
// Attendance Reports — Stage 1
// Read-only daily office detail + all-office summary
// ----------------------------------

function getAttendanceDailyReport(request) {
  const source = request && typeof request === "object" ? request : {};
  const dateText = String(source.date || "").trim();
  const requestedCamp = normalizeAttendanceValue_(source.camp);
  const requestedOffice = normalizeAttendanceValue_(source.office);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error("Select a valid report date.");
  }

  setupAttendanceCenterSheets();
  const spreadsheet = SpreadsheetApp.openById(ATTENDANCE_CENTER_CONFIG.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(ATTENDANCE_CENTER_CONFIG.logSheet);
  const empty = {
    success: true,
    date: dateText,
    camps: [],
    selectedCamp: requestedCamp,
    selectedOffice: "",
    offices: [],
    detailsByOffice: {},
    grandTotal: attendanceReportEmptyCounts_(),
  };

  if (!sheet || sheet.getLastRow() < 2) return empty;

  const timezone = Session.getScriptTimeZone();
  const rows = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, ATTENDANCE_LOG_HEADERS.length)
    .getValues()
    .filter(row => {
      const rowDate = row[1] instanceof Date
        ? Utilities.formatDate(row[1], timezone, "yyyy-MM-dd")
        : String(row[1] || "").trim();
      return rowDate === dateText;
    });

  const camps = Array.from(new Set(rows.map(row => String(row[6] || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b));
  const selectedCamp = requestedCamp || normalizeAttendanceValue_(camps[0] || "");
  const filteredRows = rows.filter(row => !selectedCamp || normalizeAttendanceValue_(row[6]) === selectedCamp);

  const officeMap = new Map();
  filteredRows.forEach(row => {
    const office = String(row[5] || "").trim() || "UNASSIGNED";
    const officeKey = normalizeAttendanceValue_(office);
    if (!officeMap.has(officeKey)) {
      officeMap.set(officeKey, {
        office,
        counts: attendanceReportEmptyCounts_(),
        personnel: [],
      });
    }

    const group = officeMap.get(officeKey);
    const status = normalizeAttendanceReportStatus_(row[8]);
    group.counts[status]++;
    group.counts.TOTAL++;
    group.personnel.push({
      employeeKey: String(row[2] || ""),
      personnel: [String(row[4] || "").trim(), String(row[3] || "").trim()].filter(Boolean).join(" "),
      fullName: String(row[3] || "").trim(),
      rank: String(row[4] || "").trim(),
      status,
    });
  });

  const rankIndex = attendanceReportRankIndex_();
  const groups = Array.from(officeMap.values()).sort((a, b) => a.office.localeCompare(b.office));
  const detailsByOffice = {};
  const grandTotal = attendanceReportEmptyCounts_();

  groups.forEach(group => {
    group.personnel.sort((a, b) => {
      const rankDifference = (rankIndex[a.rank.toUpperCase()] ?? 9999) - (rankIndex[b.rank.toUpperCase()] ?? 9999);
      return rankDifference || a.fullName.localeCompare(b.fullName);
    });
    detailsByOffice[group.office] = group.personnel;
    Object.keys(grandTotal).forEach(key => { grandTotal[key] += group.counts[key]; });
  });

  const offices = groups.map(group => Object.assign({ office: group.office }, group.counts));
  let selectedOffice = groups.find(group => normalizeAttendanceValue_(group.office) === requestedOffice)?.office || "";
  if (!selectedOffice && groups.length) selectedOffice = groups[0].office;

  return {
    success: true,
    date: dateText,
    camps,
    selectedCamp: groups.length ? String(filteredRows[0]?.[6] || "") : (camps[0] || ""),
    selectedOffice,
    offices,
    detailsByOffice,
    grandTotal,
  };
}

function attendanceReportEmptyCounts_() {
  return { PRESENT: 0, ABSENT: 0, LEAVE: 0, OB: 0, OFF: 0, UNRECORDED: 0, TOTAL: 0 };
}

function normalizeAttendanceReportStatus_(value) {
  const status = normalizeAttendanceValue_(value);
  return ["PRESENT", "ABSENT", "LEAVE", "OB", "OFF", "UNRECORDED"].includes(status)
    ? status
    : "UNRECORDED";
}

function attendanceReportRankIndex_() {
  const ranks = [
    "CSSUPT", "CTSSUPT", "CSUPT", "CTSUPT", "CCINSP", "CTCINSP", "CSINSP", "CTSINSP", "CINSP", "CTINSP",
    "CSO4", "CTSO4", "CSO3", "CTSO3", "CSO2", "CTSO2", "CSO1", "CTSO1",
    "CO3", "CTO3", "CO2", "CTO2", "CO1", "CTO1"
  ];
  return ranks.reduce((map, rank, index) => { map[rank] = index; return map; }, {});
}
