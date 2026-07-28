//----------------------------------
// Personnel Filter Panel
// Google Apps Script
//----------------------------------

const PERSONNEL_FILTER_CONFIG = Object.freeze({
  sheetName: "LIST",
  headerRow: 1,
  firstDataRow: 2,
  primaryHeader: "FULL NAME",

  searchHeaders: [
    "FULL NAME",
    "LAST NAME",
    "MIDDLE NAME",
    "SUFFIX",
    "Designation",
    "Office",
    "SUB UNIT",
    "CAMP",
    "RANK",
    "GENDER",
    "Category",
    "TYPE"
  ],

  chipHeaders: {
    camp: "CAMP",
    rank: "RANK",
    office: "Office",
    gender: "GENDER",
    category: "Category",
    type: "TYPE"
  },

  removeNativeFilterOnApply: true,
  removeSlicersOnApply: true,
  lockTimeoutMs: 15000
});


//----------------------------------
// Menu
//----------------------------------

function onOpen() {

  SpreadsheetApp
    .getUi()
    .createMenu(
      "Personnel"
    )

    .addItem(
      "Open Personnel Panel",
      "openPersonnelPanel"
    )

    .addItem(
      "Open Summary Report",
      "openPersonnelSummaryReport"
    )

    .addSeparator()

    .addItem(
      "Show All Personnel",
      "showAllPersonnel"
    )

    .addToUi();

}


//----------------------------------
// Open Wide Modeless Panel
//----------------------------------

function openPersonnelPanel() {
  resetPersonnelView_();

  const html = HtmlService
    .createHtmlOutputFromFile("PersonnelFilterPanel")
    .setTitle("Personnel Filter")
    .setWidth(600)
    .setHeight(1200);


  SpreadsheetApp
    .getUi()
    .showModelessDialog(
      html,
      "Personnel Filter"
    );
}


//----------------------------------
// Load Chip Options
//----------------------------------

function getPersonnelFilterOptions() {
  const sheet = getPersonnelSheet_();
  const table = readPersonnelTable_(sheet);

  const options = {};

  Object.keys(
    PERSONNEL_FILTER_CONFIG.chipHeaders
  ).forEach(function (key) {
    const headerName =
      PERSONNEL_FILTER_CONFIG
        .chipHeaders[key];

    const columnIndex =
      getOptionalHeaderIndex_(
        table.headerMap,
        headerName
      );

    options[key] =
      Number.isInteger(columnIndex)
        ? getUniqueColumnValues_(
            table.records,
            columnIndex
          )
        : [];
  });

  return {
    options: options,
    totalRecords: table.records.length,
    updatedAt: Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "MMM d, yyyy h:mm:ss a"
    )
  };
}


//----------------------------------
// Apply Filters
//----------------------------------

function applyPersonnelFilters(rawFilters) {
  const lock =
    LockService.getDocumentLock();

  lock.waitLock(
    PERSONNEL_FILTER_CONFIG
      .lockTimeoutMs
  );

  try {
    const startedAt = Date.now();

    const sheet = getPersonnelSheet_();

    resetPersonnelView_(sheet);

    const table =
      readPersonnelTable_(sheet);

    const filters =
      normalizeFilterObject_(
        rawFilters
      );

storePersonnelFilters_(
  filters
);      

    if (!table.records.length) {
      return {
        visibleCount: 0,
        totalCount: 0,
        elapsedMs:
          Date.now() - startedAt,
        message:
          "No personnel records found."
      };
    }

    if (!hasActiveFilters_(filters)) {
      return {
        visibleCount:
          table.records.length,
        totalCount:
          table.records.length,
        elapsedMs:
          Date.now() - startedAt,
        message:
          "Showing all personnel."
      };
    }

    const searchIndexes =
      resolveSearchIndexes_(
        table.headerMap
      );

    const chipIndexes =
      resolveChipIndexes_(
        table.headerMap
      );

    const rowsToHide = [];

    let visibleCount = 0;

    table.records.forEach(
      function (record) {
        const matches =
          personnelRecordMatches_(
            record.values,
            filters,
            searchIndexes,
            chipIndexes
          );

        if (matches) {
          visibleCount++;
        } else {
          rowsToHide.push(
            record.sheetRow
          );
        }
      }
    );

    hideRowGroups_(
      sheet,
      rowsToHide
    );

    SpreadsheetApp.flush();

    return {
      visibleCount: visibleCount,
      totalCount:
        table.records.length,
      hiddenCount:
        rowsToHide.length,
      elapsedMs:
        Date.now() - startedAt,
      message:
        visibleCount === 0
          ? "No matching personnel found."
          : visibleCount === 1
            ? "1 personnel record shown."
            : visibleCount +
              " personnel records shown."
    };

  } finally {
    lock.releaseLock();
  }
}


//----------------------------------
// Show All
//----------------------------------

function showAllPersonnel() {
  const lock =
    LockService.getDocumentLock();

  lock.waitLock(
    PERSONNEL_FILTER_CONFIG
      .lockTimeoutMs
  );

  try {
    const sheet =
      getPersonnelSheet_();

    resetPersonnelView_(sheet);
    
    clearStoredPersonnelFilters_();

    const total =
      readPersonnelTable_(sheet)
        .records.length;

    SpreadsheetApp.flush();

    return {
      visibleCount: total,
      totalCount: total,
      message:
        "All personnel are visible."
    };

  } finally {
    lock.releaseLock();
  }
}


//----------------------------------
// Reset Sheet View
//----------------------------------

function resetPersonnelView_(
  providedSheet
) {
  const sheet =
    providedSheet ||
    getPersonnelSheet_();

  if (
    PERSONNEL_FILTER_CONFIG
      .removeNativeFilterOnApply
  ) {
    const filter =
      sheet.getFilter();

    if (filter) {
      filter.remove();
    }
  }

  if (
    PERSONNEL_FILTER_CONFIG
      .removeSlicersOnApply
  ) {
    sheet
      .getSlicers()
      .forEach(function (slicer) {
        slicer.remove();
      });
  }

  const lastRow =
    sheet.getLastRow();

  if (
    lastRow >=
    PERSONNEL_FILTER_CONFIG
      .firstDataRow
  ) {
    sheet.showRows(
      PERSONNEL_FILTER_CONFIG
        .firstDataRow,
      lastRow -
        PERSONNEL_FILTER_CONFIG
          .firstDataRow +
        1
    );
  }
}


//----------------------------------
// Read Table
//----------------------------------

function readPersonnelTable_(sheet) {
  const config =
    PERSONNEL_FILTER_CONFIG;

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  const headers =
    sheet
      .getRange(
        config.headerRow,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0];

  const headerMap =
    createHeaderMap_(headers);

  const primaryIndex =
    getRequiredHeaderIndex_(
      headerMap,
      config.primaryHeader
    );

  if (
    lastRow <
    config.firstDataRow
  ) {
    return {
      headers: headers,
      headerMap: headerMap,
      records: []
    };
  }

  const rowCount =
    lastRow -
    config.firstDataRow +
    1;

  const values =
    sheet
      .getRange(
        config.firstDataRow,
        1,
        rowCount,
        lastColumn
      )
      .getDisplayValues();

  const records = [];

  values.forEach(
    function (row, index) {
      if (
        !normalizeText_(
          row[primaryIndex]
        )
      ) {
        return;
      }

      records.push({
        sheetRow:
          config.firstDataRow +
          index,
        values: row
      });
    }
  );

  return {
    headers: headers,
    headerMap: headerMap,
    records: records
  };
}


//----------------------------------
// Match Record
//----------------------------------

function personnelRecordMatches_(
  row,
  filters,
  searchIndexes,
  chipIndexes
) {
  if (filters.search) {
    const searchMatches =
      searchIndexes.some(
        function (columnIndex) {
          return normalizeText_(
            row[columnIndex]
          ).includes(
            filters.search
          );
        }
      );

    if (!searchMatches) {
      return false;
    }
  }

  const chipKeys = [
    "camp",
    "rank",
    "office",
    "gender",
    "category",
    "type"
  ];

  for (
    let index = 0;
    index < chipKeys.length;
    index++
  ) {
    const key = chipKeys[index];

    const selectedValues =
      filters[key];

    if (
      !Array.isArray(
        selectedValues
      ) ||
      !selectedValues.length
    ) {
      continue;
    }

    const columnIndex =
      chipIndexes[key];

    if (
      !Number.isInteger(
        columnIndex
      )
    ) {
      return false;
    }

    const actualValue =
      normalizeText_(
        row[columnIndex]
      );

    if (
      !selectedValues.includes(
        actualValue
      )
    ) {
      return false;
    }
  }

  return true;
}


//----------------------------------
// Resolve Columns
//----------------------------------

function resolveSearchIndexes_(
  headerMap
) {
  const indexes =
    PERSONNEL_FILTER_CONFIG
      .searchHeaders
      .map(function (headerName) {
        return getOptionalHeaderIndex_(
          headerMap,
          headerName
        );
      })
      .filter(function (index) {
        return Number.isInteger(index);
      });

  if (!indexes.length) {
    throw new Error(
      "No configured search headers were found."
    );
  }

  return indexes;
}


function resolveChipIndexes_(
  headerMap
) {
  const indexes = {};

  Object.keys(
    PERSONNEL_FILTER_CONFIG
      .chipHeaders
  ).forEach(function (key) {
    indexes[key] =
      getOptionalHeaderIndex_(
        headerMap,
        PERSONNEL_FILTER_CONFIG
          .chipHeaders[key]
      );
  });

  return indexes;
}


//----------------------------------
// Normalize Filters
//----------------------------------

function normalizeFilterObject_(
  filters
) {
  filters = filters || {};

  return {
    search:
      normalizeText_(
        filters.search
      ),

    camp:
      normalizeArray_(
        filters.camp
      ),

    rank:
      normalizeArray_(
        filters.rank
      ),

    office:
      normalizeArray_(
        filters.office
      ),

    gender:
      normalizeArray_(
        filters.gender
      ),

    category:
      normalizeArray_(
        filters.category
      ),

    type:
      normalizeArray_(
        filters.type
      )
  };
}


function normalizeArray_(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map(normalizeText_)
    .filter(Boolean);
}


function hasActiveFilters_(
  filters
) {
  return Boolean(
    filters.search ||
    filters.camp.length ||
    filters.rank.length ||
    filters.office.length ||
    filters.gender.length ||
    filters.category.length ||
    filters.type.length
  );
}


//----------------------------------
// Header Helpers
//----------------------------------

function createHeaderMap_(headers) {
  const map = {};

  headers.forEach(
    function (header, index) {
      const key =
        normalizeText_(header);

      if (
        key &&
        !Object.prototype
          .hasOwnProperty
          .call(map, key)
      ) {
        map[key] = index;
      }
    }
  );

  return map;
}


function getRequiredHeaderIndex_(
  headerMap,
  headerName
) {
  const index =
    getOptionalHeaderIndex_(
      headerMap,
      headerName
    );

  if (!Number.isInteger(index)) {
    throw new Error(
      'Required header not found: "' +
      headerName +
      '".'
    );
  }

  return index;
}


function getOptionalHeaderIndex_(
  headerMap,
  headerName
) {
  const index =
    headerMap[
      normalizeText_(
        headerName
      )
    ];

  return Number.isInteger(index)
    ? index
    : null;
}


//----------------------------------
// Unique Chip Values
//----------------------------------

function getUniqueColumnValues_(
  records,
  columnIndex
) {
  const unique = new Map();

  records.forEach(
    function (record) {
      const displayValue =
        String(
          record.values[
            columnIndex
          ] || ""
        ).trim();

      const normalized =
        normalizeText_(
          displayValue
        );

      if (
        normalized &&
        !unique.has(normalized)
      ) {
        unique.set(
          normalized,
          displayValue
        );
      }
    }
  );

  return Array
    .from(unique.values())
    .sort(function (a, b) {
      return a.localeCompare(
        b,
        undefined,
        {
          numeric: true,
          sensitivity: "base"
        }
      );
    });
}


//----------------------------------
// Hide Row Groups
//----------------------------------

function hideRowGroups_(
  sheet,
  rowNumbers
) {
  if (
    !Array.isArray(rowNumbers) ||
    !rowNumbers.length
  ) {
    return;
  }

  let groupStart =
    rowNumbers[0];

  let previousRow =
    rowNumbers[0];

  for (
    let index = 1;
    index < rowNumbers.length;
    index++
  ) {
    const currentRow =
      rowNumbers[index];

    if (
      currentRow ===
      previousRow + 1
    ) {
      previousRow =
        currentRow;

      continue;
    }

    sheet.hideRows(
      groupStart,
      previousRow -
        groupStart +
        1
    );

    groupStart =
      currentRow;

    previousRow =
      currentRow;
  }

  sheet.hideRows(
    groupStart,
    previousRow -
      groupStart +
      1
  );
}


//----------------------------------
// General Helpers
//----------------------------------

function getPersonnelSheet_() {
  const sheet =
    SpreadsheetApp
      .getActive()
      .getSheetByName(
        PERSONNEL_FILTER_CONFIG
          .sheetName
      );

  if (!sheet) {
    throw new Error(
      'Sheet "' +
      PERSONNEL_FILTER_CONFIG
        .sheetName +
      '" was not found.'
    );
  }

  return sheet;
}


function normalizeText_(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}