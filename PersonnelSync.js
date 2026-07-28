//----------------------------------
// Apply Visible Personnel Rows
//----------------------------------

function applyPersonnelVisibleRows(
  payload
) {

  const sheet =
    getPersonnelWebSheet_();

  const firstDataRow =
    PERSONNEL_WEB_CONFIG
      .firstDataRow;

  const lastRow =
    sheet.getLastRow();

  if (
    lastRow <
    firstDataRow
  ) {

    return {

      visibleRows: 0,

      hiddenRows: 0,

    };

  }

  const totalDataRows =
    lastRow -
    firstDataRow +
    1;

  const matchingRows =
    Array.isArray(
      payload &&
      payload.matchingRows
    )
      ? payload.matchingRows
      : [];

  const visibleRows =
    new Set(
      matchingRows
        .map(Number)
        .filter(
          row =>
            Number.isInteger(row) &&
            row >= firstDataRow &&
            row <= lastRow
        )
    );

  //----------------------------------
  // Show Everything First
  //----------------------------------

  sheet.showRows(
    firstDataRow,
    totalDataRows
  );

  //----------------------------------
  // Hide All if No Match
  //----------------------------------

  if (
    visibleRows.size === 0
  ) {

    sheet.hideRows(
      firstDataRow,
      totalDataRows
    );

    return {

      visibleRows: 0,

      hiddenRows:
        totalDataRows,

    };

  }

  //----------------------------------
  // Hide Consecutive Unmatched Rows
  //----------------------------------

  let blockStart = null;
  let blockLength = 0;

  for (
    let row = firstDataRow;
    row <= lastRow;
    row++
  ) {

    if (
      !visibleRows.has(row)
    ) {

      if (
        blockStart === null
      ) {

        blockStart = row;
        blockLength = 1;

      } else {

        blockLength++;

      }

      continue;

    }

    if (
      blockStart !== null
    ) {

      sheet.hideRows(
        blockStart,
        blockLength
      );

      blockStart = null;
      blockLength = 0;

    }

  }

  //----------------------------------
  // Hide Final Block
  //----------------------------------

  if (
    blockStart !== null
  ) {

    sheet.hideRows(
      blockStart,
      blockLength
    );

  }

  return {

    visibleRows:
      visibleRows.size,

    hiddenRows:
      totalDataRows -
      visibleRows.size,

  };

}