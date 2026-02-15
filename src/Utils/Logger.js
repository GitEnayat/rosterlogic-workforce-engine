/**
 * Logger Module
 * -------------
 * Centralized logging system for the engine.
 * Supports buffering logs to memory and flushing them in batches to reduce API calls.
 *
 * @file Logger.js
 */

const LOG_BUFFER = [];

/**
 * Buffers a log entry to memory.
 * Does NOT write to the sheet until flushLogs() is called.
 * 
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssDb - Central DB (not used directly in buffer mode but kept for signature)
 * @param {string} runId - Execution context ID
 * @param {string} level - Log level (INFO, WARN, ERROR)
 * @param {string} message - Log message
 * @param {string} context - Optional context data
 * @returns {void}
 */
function writeSystemLog(ssDb, runId, level, message, context = "") {
  LOG_BUFFER.push([
    runId,
    new Date(),
    level,
    message,
    context
  ]);
}

/**
 * Validates and flushes the log buffer to the System_Logs sheet in one batch operation.
 * Should be called at the very end of the execution.
 */
function flushLogs(ssDb) {
  if (!LOG_BUFFER.length) return;

  try {
    let sh = ssDb.getSheetByName(CONFIG.tabs.logs.name);
    if (!sh) {
      sh = ssDb.insertSheet(CONFIG.tabs.logs.name);
      sh.appendRow(Object.values(CONFIG.tabs.logs.h));
    }

    // Batch write to the end of the sheet
    const lastRow = sh.getLastRow();
    sh.getRange(lastRow + 1, 1, LOG_BUFFER.length, LOG_BUFFER[0].length).setValues(LOG_BUFFER);

    // Clear buffer after successful write
    LOG_BUFFER.length = 0;
  } catch (e) {
    console.error("Failed to flush logs:", e);
  }
}

function logInfo(ssDb, runId, msg, ctx = "") {
  writeSystemLog(ssDb, runId, "INFO", msg, ctx);
}

function logWarn(ssDb, runId, msg, ctx = "") {
  writeSystemLog(ssDb, runId, "WARN", msg, ctx);
}

function logError(ssDb, runId, msg, ctx = "") {
  writeSystemLog(ssDb, runId, "ERROR", msg, ctx);
}


/**
 * Generates a unique execution ID for tracing logs.
 * 
 * @returns {string} UUID via Utilities.getUuid()
 */
function generateRunId() {
  return Utilities.getUuid();
}