
/**
 * Validation Module
 * -----------------
 * Provides critical checks for database connectivity and workspace structure.
 * Ensures that required sheets and tabs exist before processing begins.
 *
 * @file Validation.js
 */

/**
 * Validates that the Central Database contains all core config sheets.
 * Throws an error if any critical sheet is missing.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssDb - Central Database
 * @param {string} runId - Execution ID for logging
 * @returns {void}
 */
function validateCentralDatabase(ssDb, runId) {
  const requiredSheets = [
    CONFIG.tabs.config.name,
    CONFIG.tabs.rules.name,
    CONFIG.tabs.decision.name,
    CONFIG.tabs.ledger.name
  ];

  const missing = requiredSheets.filter(name => !ssDb.getSheetByName(name));

  if (missing.length) {
    const msg = "Missing required sheets in Central DB: " + missing.join(", ");
    logError(ssDb, runId, msg);
    throw new Error(msg);
  }
}

/**
 * Validates that a specific workspace spreadsheet has the required Roster Config tabs.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssDb - Central Database (for logging)
 * @param {string} runId - Execution ID
 * @param {string} schedId - Workspace File ID
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} The opened spreadsheet object
 * @throws {Error} If tabs are missing or file cannot be opened
 */
function validateWorkspace(ssDb, runId, schedId) {
  const ssSched = SpreadsheetApp.openById(schedId);
  const requiredTabs = CONFIG.roster.tabs;

  const missingTabs = requiredTabs.filter(t => !ssSched.getSheetByName(t));

  if (missingTabs.length) {
    const msg = `Workspace missing required tabs: ${missingTabs.join(", ")}`;
    logError(ssDb, runId, msg, schedId);
    throw new Error(msg);
  }
  return ssSched;
}
