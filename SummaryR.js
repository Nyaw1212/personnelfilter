//----------------------------------
// SummaryReport.gs
//----------------------------------
//
// Personnel summary sidebar.
//
// Uses the active personnel filters
// stored by applyPersonnelFilters().
//----------------------------------


//----------------------------------
// Summary Configuration
//----------------------------------

const PERSONNEL_SUMMARY_CONFIG =
  Object.freeze({

    propertyKey:
      "PERSONNEL_ACTIVE_FILTERS",

    sidebarTitle:
      "Personnel Summary",

    sections: {

      camp: {
        label: "Camp",
        header: "CAMP"
      },

      category: {
        label: "Category",
        header: "Category"
      },

      gender: {
        label: "Gender",
        header: "GENDER"
      },

      rank: {
        label: "Rank",
        header: "RANK"
      },

      type: {
        label: "Type",
        header: "TYPE"
      }

    }

  });


//----------------------------------
// Open Summary Sidebar
//----------------------------------

function openPersonnelSummaryReport() {

  const html =
    HtmlService
      .createHtmlOutputFromFile(
        "SummaryReport"
      )
      .setTitle(
        PERSONNEL_SUMMARY_CONFIG
          .sidebarTitle
      );

  SpreadsheetApp
    .getUi()
    .showSidebar(html);

}


//----------------------------------
// Get Summary Report
//----------------------------------

function getPersonnelSummaryReport() {

  const startedAt =
    Date.now();

  const sheet =
    getPersonnelSheet_();

  const table =
    readPersonnelTable_(sheet);

  const filters =
    getStoredPersonnelFilters_();

  const searchIndexes =
    resolveSearchIndexes_(
      table.headerMap
    );

  const chipIndexes =
    resolveChipIndexes_(
      table.headerMap
    );

  const summaryIndexes =
    resolvePersonnelSummaryIndexes_(
      table.headerMap
    );

  const summaryMaps =
    createPersonnelSummaryMaps_();

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

      if (!matches) {
        return;
      }

      visibleCount++;

      Object.keys(
        PERSONNEL_SUMMARY_CONFIG.sections
      ).forEach(
        function (key) {

          const columnIndex =
            summaryIndexes[key];

          if (
            !Number.isInteger(
              columnIndex
            )
          ) {
            return;
          }

          const value =
            record.values[
              columnIndex
            ];

          addPersonnelSummaryCount_(
            summaryMaps[key],
            value
          );

        }
      );

    }
  );

  const sections = {};

  Object.keys(
    PERSONNEL_SUMMARY_CONFIG.sections
  ).forEach(
    function (key) {

      sections[key] =
        serializePersonnelSummaryMap_(
          key,
          summaryMaps[key]
        );

    }
  );

  return {

    visibleCount:
      visibleCount,

    hiddenCount:
      Math.max(
        0,
        table.records.length -
          visibleCount
      ),

    totalCount:
      table.records.length,

    hasActiveFilters:
      hasActiveFilters_(filters),

    sections:
      sections,

    elapsedMs:
      Date.now() - startedAt,

    updatedAt:
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "MMM d, yyyy h:mm:ss a"
      )

  };

}


//----------------------------------
// Resolve Summary Columns
//----------------------------------

function resolvePersonnelSummaryIndexes_(
  headerMap
) {

  const indexes = {};

  Object.keys(
    PERSONNEL_SUMMARY_CONFIG.sections
  ).forEach(
    function (key) {

      const headerName =
        PERSONNEL_SUMMARY_CONFIG
          .sections[key]
          .header;

      indexes[key] =
        getOptionalHeaderIndex_(
          headerMap,
          headerName
        );

    }
  );

  return indexes;

}


//----------------------------------
// Create Empty Summary Maps
//----------------------------------

function createPersonnelSummaryMaps_() {

  const maps = {};

  Object.keys(
    PERSONNEL_SUMMARY_CONFIG.sections
  ).forEach(
    function (key) {

      maps[key] =
        new Map();

    }
  );

  return maps;

}


//----------------------------------
// Add Summary Count
//----------------------------------

function addPersonnelSummaryCount_(
  summaryMap,
  rawValue
) {

  const displayValue =
    String(
      rawValue || ""
    ).trim() ||
    "Unspecified";

  const normalizedValue =
    normalizeText_(
      displayValue
    ) ||
    "unspecified";

  if (
    !summaryMap.has(
      normalizedValue
    )
  ) {

    summaryMap.set(
      normalizedValue,
      {
        label:
          displayValue,

        count:
          0
      }
    );

  }

  const item =
    summaryMap.get(
      normalizedValue
    );

  item.count++;

}


//----------------------------------
// Serialize Summary Section
//----------------------------------

function serializePersonnelSummaryMap_(
  key,
  summaryMap
) {

  const config =
    PERSONNEL_SUMMARY_CONFIG
      .sections[key];

  const items =
    Array.from(
      summaryMap.values()
    );

  items.sort(
    function (a, b) {

      if (
        b.count !==
        a.count
      ) {

        return (
          b.count -
          a.count
        );

      }

      return a.label.localeCompare(
        b.label,
        undefined,
        {
          numeric: true,
          sensitivity: "base"
        }
      );

    }
  );

  const total =
    items.reduce(
      function (
        runningTotal,
        item
      ) {

        return (
          runningTotal +
          item.count
        );

      },
      0
    );

  return {

    key:
      key,

    label:
      config.label,

    total:
      total,

    items:
      items

  };

}


//----------------------------------
// Store Active Filters
//----------------------------------

function storePersonnelFilters_(
  filters
) {

  const normalizedFilters =
    normalizeFilterObject_(
      filters
    );

  PropertiesService
    .getDocumentProperties()
    .setProperty(
      PERSONNEL_SUMMARY_CONFIG
        .propertyKey,

      JSON.stringify(
        normalizedFilters
      )
    );

}


//----------------------------------
// Get Stored Filters
//----------------------------------

function getStoredPersonnelFilters_() {

  const storedValue =
    PropertiesService
      .getDocumentProperties()
      .getProperty(
        PERSONNEL_SUMMARY_CONFIG
          .propertyKey
      );

  if (!storedValue) {

    return normalizeFilterObject_(
      {}
    );

  }

  try {

    return normalizeFilterObject_(
      JSON.parse(
        storedValue
      )
    );

  } catch (error) {

    console.warn(
      "Could not read stored personnel filters.",
      error
    );

    return normalizeFilterObject_(
      {}
    );

  }

}


//----------------------------------
// Clear Stored Filters
//----------------------------------

function clearStoredPersonnelFilters_() {

  PropertiesService
    .getDocumentProperties()
    .deleteProperty(
      PERSONNEL_SUMMARY_CONFIG
        .propertyKey
    );

}


//----------------------------------
// Test Summary Report
//----------------------------------

function testPersonnelSummaryReport() {

  const report =
    getPersonnelSummaryReport();

  console.log(
    JSON.stringify(
      report,
      null,
      2
    )
  );

  return report;

}