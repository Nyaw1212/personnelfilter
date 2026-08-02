// ==================================
// Shared server utilities
// ==================================

const ServerUtils = Object.freeze({
  normalizeText(value) {
    return String(value == null ? "" : value).trim();
  },

  normalizeUpper(value) {
    return this.normalizeText(value).toUpperCase();
  },

  formatIsoDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid date value.");
    }

    return Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
  },

  getCurrentUserEmail() {
    return this.normalizeText(Session.getActiveUser().getEmail()) ||
      this.normalizeText(Session.getEffectiveUser().getEmail()) ||
      "apps-script";
  },

  parseJsonSafely(text) {
    const source = this.normalizeText(text);
    if (!source) return null;

    try {
      return JSON.parse(source);
    } catch (error) {
      return source;
    }
  }
});
