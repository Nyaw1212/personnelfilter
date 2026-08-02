// ==================================
// Server configuration
// ==================================
// Secrets and environment-specific values must be stored in
// Apps Script > Project Settings > Script Properties.

const APP_CONFIG = Object.freeze({
  NEON: Object.freeze({
    DATA_API_URL_PROPERTY: "NEON_DATA_API_URL",
    DATA_API_TOKEN_PROPERTY: "NEON_DATA_API_TOKEN",
    ATTENDANCE_TABLE: "attendance",
    AUDIT_TABLE: "attendance_audit"
  }),

  ATTENDANCE_STATUSES: Object.freeze([
    "PRESENT",
    "ABSENT",
    "LEAVE",
    "OB",
    "OFF",
    "UNRECORDED"
  ])
});
