/**
 * Helpers Module
 * --------------
 * General utility functions for date parsing, string manipulation, 
 * header mapping, and safe UI interactions.
 * 
 * @file Helpers.js
 */
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** 
 * Returns 3-letter day name from Date object.
 * @param {Date} d 
 * @returns {string} e.g. "MON"
 */
function getDayName(d) { return DAY_NAMES[d.getDay()]; }

/** 
 * Normalizes day string to 3-letter uppercase.
 * @param {string|Date} d 
 * @returns {string} e.g. "WED"
 */
function normalizeDay(d) { return d ? String(d).toUpperCase().substring(0, 3) : ""; }

/** 
 * Safely parses a value into a Date object.
 * @param {string|Date} v 
 * @returns {Date|null} Date object or null if invalid
 */
function parseSafeDate(v) { if (v instanceof Date) return v; if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; }

/** 
 * Formats date to YYYY-MM-DD using spreadsheet timezone.
 * @param {Date} d 
 * @returns {string}
 */
function formatDate(d) { return Utilities.formatDate(d, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM-dd"); }

/** 
 * Maps header names to column indices.
 * @param {Array<string>} r - Header row values
 * @returns {Map<string, number>} Map of lowercase header -> index
 */
function mapHeaders(r) { const m = new Map(); if (!r) return m; r.forEach((v, i) => m.set(String(v).trim().toLowerCase(), i)); return m; }

/** 
 * Checks value against criteria with special keywords (ANY, IGNORED).
 * @param {string} c - Criteria
 * @param {string} v - Value to check
 * @returns {boolean} Match result
 */
function checkMatch(c, v) { c = String(c).toUpperCase().trim(); v = String(v).toUpperCase().trim(); if (c === 'ANY' || c === 'IGNORED') return true; if (c === 'COMP_DAY' && (v === 'COMP_DAY' || v === 'OFF')) return true; if (c === 'LEAVE' && v === 'LEAVE') return true; return c === v; }


/**
 * Parses a simple list from a sheet column into a Set of strings.
 * Used for Holiday lists.
 * 
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh - Source sheet
 * @param {string} col - Header name to search for
 * @returns {Set<string>} Set of values (formatted dates)
 */
function parseSimpleList(sh, col) {
  if (!sh) return new Set();
  const d = sh.getDataRange().getValues(), idx = d[0].indexOf(col), s = new Set();
  if (idx > -1) for (let i = 1; i < d.length; i++) { const dt = parseSafeDate(d[i][idx]); if (dt) s.add(formatDate(dt)); }
  return s;
}


/**
 * Writes the daily processing results to the "Daily_Workforce_Status" sheet.
 * Clears existing content before writing new batch.
 * 
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Workspace spreadsheet
 * @param {Array<Array<string>>} rows - Data rows to write
 * @returns {void}
 */
function writeDailyOutput(ss, rows) {
  if (CONFIG.isDryRun) {
    console.log("DRY RUN: Skipping writeDailyOutput()");
    return;
  }

  let sh = ss.getSheetByName(CONFIG.tabs.dailyStatus.name);
  if (!sh) sh = ss.insertSheet(CONFIG.tabs.dailyStatus.name);
  const h = ['Key', 'employee', 'Date', 'Base_Status', 'Base_Shift', 'Rule_Input', 'Leave_Input', 'PH_Input', 'Entitlement_Input', 'Final_Status', 'Final_Shift', 'Reason', 'Note', 'Final_Val'];
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  }

  sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold');
  if (rows.length) sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * Safe wrapper for ss.toast() that swallows errors (e.g. in headless mode).
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss 
 * @param {string} message 
 * @param {string} title 
 * @param {number} timeout 
 */
function safeToast(ss, message, title = "Workforce Engine", timeout = 5) {
  try { ss.toast(message, title, timeout); } catch (_) { }
}

/**
 * Safe wrapper for Ui.alert() that swallows errors.
 * @param {string} message 
 */
function safeAlert(message) {
  try { SpreadsheetApp.getUi().alert(message); } catch (_) { }
}
