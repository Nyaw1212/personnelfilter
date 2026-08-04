//----------------------------------
// Transfer Queue apply diagnostics
//----------------------------------
// Loaded after the canonical queue service so Approve & Apply logs the
// complete result, including per-person failure reasons.

function approveAndApplyTransfersCanonical(transferIds) {
  const startedAt = Date.now();
  const ids = Array.isArray(transferIds) ? transferIds : [];

  console.log(
    "[TransferQ][ApproveAndApply] START selected=%s ids=%s",
    ids.length,
    JSON.stringify(ids)
  );

  const result = canonicalApplyTransfers_(ids, true);

  console.log(
    "[TransferQ][ApproveAndApply] END total=%sms result=%s",
    Date.now() - startedAt,
    JSON.stringify(result, null, 2)
  );

  return result;
}
