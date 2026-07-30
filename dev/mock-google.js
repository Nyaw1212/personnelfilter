(() => {
  const sampleRecords = [
    { __sheetRow: 2, Rank: "CSUPT", "Full Name": "GARY A GARCIA", Gender: "MALE", Category: "CORRECTIONS OFFICER", Type: "Commissioned Officer", Office: "OFFICE OF THE SUPERINTENDENT", Camp: "NBP" },
    { __sheetRow: 3, Rank: "CO1", "Full Name": "REX VILLARBA", Gender: "MALE", Category: "CORRECTIONS OFFICER", Type: "Non-Commissioned Officer", Office: "ESCORT", Camp: "NBP" },
    { __sheetRow: 4, Rank: "CO1", "Full Name": "CLYDE WALTER FIRMALAN", Gender: "MALE", Category: "CORRECTIONS OFFICER", Type: "Non-Commissioned Officer", Office: "ESCORT", Camp: "MAXIMUM" },
    { __sheetRow: 5, Rank: "CO1", "Full Name": "ARIS PANTIN", Gender: "MALE", Category: "CORRECTIONS OFFICER", Type: "Non-Commissioned Officer", Office: "ESCORT", Camp: "MEDIUM" },
    { __sheetRow: 6, Rank: "CO1", "Full Name": "BRYAL PUEDIVAN", Gender: "MALE", Category: "CORRECTIONS OFFICER", Type: "Non-Commissioned Officer", Office: "ESCORT", Camp: "MINIMUM" },
    { __sheetRow: 7, Rank: "CTSO3", "Full Name": "NAYAFOR GILERA ABE", Gender: "MALE", Category: "TECHNICAL", Type: "Technical Non-Commissioned", Office: "NBPH", Camp: "RDC" }
  ];

  const handlers = {
    getPersonnelWebAppDataOptimized: () => ({ records: sampleRecords }),
    applyPersonnelVisibleRows: payload => ({ success: true, payload }),
    clearPersonnelPerformanceCache: () => ({ success: true }),
    getOfficeSigningDirectory: () => ({
      success: true,
      records: [{
        office: "OFFICE OF THE SUPERINTENDENT",
        chiefName: "CSUPT GARY A GARCIA RCrim., MSCA",
        chiefPosition: "Superintendent, New Bilibid Prison",
        deputyName: "",
        deputyPosition: ""
      }]
    }),
    getGeneratedReports: () => ({ success: true, reports: [] }),
    getGeneratedReportPreview: () => ({ success: true, rows: [] }),
    getTransferQueue: () => ({ success: true, rows: [] })
  };

  function runner(success, failure) {
    return new Proxy({}, {
      get(_target, prop) {
        if (prop === "withSuccessHandler") {
          return fn => runner(fn, failure);
        }
        if (prop === "withFailureHandler") {
          return fn => runner(success, fn);
        }
        return (...args) => {
          setTimeout(() => {
            try {
              const handler = handlers[prop];
              const result = handler ? handler(...args) : { success: true };
              if (success) success(result);
            } catch (error) {
              if (failure) failure(error);
              else console.error(error);
            }
          }, 10);
        };
      }
    });
  }

  window.google = { script: { run: runner() } };
  window.__PERSONNEL_DEV__ = { sampleRecords, handlers };
  console.info("Personnel Filter local developer mode active.");
})();
