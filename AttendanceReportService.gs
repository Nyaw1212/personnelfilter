// ----------------------------------
// Attendance Reports — Neon JSON Engine
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

  const empty = {
    success: true,
    dataSource: "NEON_JSON_ENGINE",
    date: dateText,
    camps: [],
    selectedCamp: requestedCamp,
    selectedOffice: "",
    offices: [],
    detailsByOffice: {},
    grandTotal: attendanceReportEmptyCounts_()
  };

  const reportQuery = getAttendanceReportRowsFromNeon_(dateText, requestedCamp);
  const rows = reportQuery.rows;
  if (!rows.length) {
    empty.timing = reportQuery.timing;
    return empty;
  }

  const camps = Array.from(
    new Set(rows.map(row => row.camp).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const selectedCamp = requestedCamp || normalizeAttendanceValue_(camps[0] || "");
  const filteredRows = rows.filter(row =>
    !selectedCamp || normalizeAttendanceValue_(row.camp) === selectedCamp
  );

  const officeMap = new Map();

  filteredRows.forEach(row => {
    const office = row.office || "UNASSIGNED";
    const officeKey = normalizeAttendanceValue_(office);

    if (!officeMap.has(officeKey)) {
      officeMap.set(officeKey, {
        office,
        counts: attendanceReportEmptyCounts_(),
        personnel: []
      });
    }

    const group = officeMap.get(officeKey);
    const status = normalizeAttendanceReportStatus_(row.status);
    const fullName = row.fullName;
    const rank = row.rank;

    group.counts[status]++;
    group.counts.TOTAL++;
    group.personnel.push({
      employeeKey: row.employeeKey,
      personnel: attendanceReportDisplayName_(rank, fullName),
      fullName,
      rank,
      status
    });
  });

  const rankIndex = attendanceReportRankIndex_();
  const groups = Array.from(officeMap.values())
    .sort((a, b) => a.office.localeCompare(b.office));
  const detailsByOffice = {};
  const grandTotal = attendanceReportEmptyCounts_();

  groups.forEach(group => {
    group.personnel.sort((a, b) => {
      const rankDifference =
        (rankIndex[String(a.rank || "").toUpperCase()] ?? 9999) -
        (rankIndex[String(b.rank || "").toUpperCase()] ?? 9999);
      return rankDifference || a.fullName.localeCompare(b.fullName);
    });

    detailsByOffice[group.office] = group.personnel;
    Object.keys(grandTotal).forEach(key => {
      grandTotal[key] += group.counts[key];
    });
  });

  const offices = groups.map(group =>
    Object.assign({ office: group.office }, group.counts)
  );

  let selectedOffice = groups.find(group =>
    normalizeAttendanceValue_(group.office) === requestedOffice
  )?.office || "";

  if (!selectedOffice && groups.length) selectedOffice = groups[0].office;

  return {
    success: true,
    dataSource: "NEON_JSON_ENGINE",
    date: dateText,
    camps,
    selectedCamp: filteredRows.length
      ? String(filteredRows[0].camp || "")
      : (camps[0] || ""),
    selectedOffice,
    offices,
    detailsByOffice,
    grandTotal,
    timing: reportQuery.timing
  };
}

function getAttendanceReportRowsFromNeon_(dateText, requestedCamp) {
  const clauses = ["attendance_date = CAST(? AS DATE)"];
  const params = [dateText];

  if (requestedCamp) {
    clauses.push("UPPER(TRIM(camp)) = ?");
    params.push(requestedCamp);
  }

  const sql = [
    "SELECT COALESCE(json_agg(row_to_json(q)), '[]'::json)::text AS payload",
    "FROM (",
    "SELECT",
    "personnel_uid AS \"employeeKey\",",
    "COALESCE(full_name, '') AS \"fullName\",",
    "COALESCE(rank, '') AS rank,",
    "COALESCE(camp, '') AS camp,",
    "COALESCE(office, '') AS office,",
    "COALESCE(status, 'UNRECORDED') AS status",
    "FROM public.attendance",
    "WHERE " + clauses.join(" AND "),
    "ORDER BY office ASC, rank ASC, full_name ASC",
    ") q"
  ].join(" ");

  const result = NeonJsonEngine.queryJson({
    name: "AttendanceDailyReport",
    sql,
    params,
    defaultValue: []
  });

  return {
    rows: Array.isArray(result.data) ? result.data : [],
    timing: result.timing
  };
}

function attendanceReportDisplayName_(rank, fullName) {
  const cleanRank = String(rank || "").trim().replace(/\s+/g, " ");
  const cleanName = String(fullName || "").trim().replace(/\s+/g, " ");

  if (!cleanRank) return cleanName;
  if (!cleanName) return cleanRank;

  const rankPattern = cleanRank.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const repeatedRank = new RegExp("^(?:" + rankPattern + "\\s+)+", "i");
  const nameWithoutLeadingRank = cleanName.replace(repeatedRank, "").trim();

  return [cleanRank, nameWithoutLeadingRank].filter(Boolean).join(" ");
}

function attendanceReportEmptyCounts_() {
  return {
    PRESENT: 0,
    ABSENT: 0,
    LEAVE: 0,
    OB: 0,
    OFF: 0,
    UNRECORDED: 0,
    TOTAL: 0
  };
}

function normalizeAttendanceReportStatus_(value) {
  const status = normalizeAttendanceValue_(value);
  return ["PRESENT", "ABSENT", "LEAVE", "OB", "OFF", "UNRECORDED"]
    .includes(status)
    ? status
    : "UNRECORDED";
}

function attendanceReportRankIndex_() {
  const ranks = [
    "CSSUPT", "CTSSUPT", "CSUPT", "CTSUPT", "CCINSP", "CTCINSP",
    "CSINSP", "CTSINSP", "CINSP", "CTINSP", "CSO4", "CTSO4",
    "CSO3", "CTSO3", "CSO2", "CTSO2", "CSO1", "CTSO1",
    "CO3", "CTO3", "CO2", "CTO2", "CO1", "CTO1"
  ];

  return ranks.reduce((map, rank, index) => {
    map[rank] = index;
    return map;
  }, {});
}
