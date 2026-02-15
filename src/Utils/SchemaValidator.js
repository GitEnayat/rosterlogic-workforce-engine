/**
 * Schema Validation Module
 * ------------------------
 * Protects against spreadsheet structure drift.
 * Verifies that all expected headers are present before processing.
 *
 * @file SchemaValidator.js
 */

/**
 * Validates that a specific sheet contains all expected headers.
 * Fails fast if schema drift is detected.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to validate
 * @param {Object} expectedHeaders - Map or Object of header keys/names to check (values are used)
 * @param {string} sheetName - For logging context
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssDb - Database handle
 * @param {string} runId - Execution ID
 * @throws {Error} If headers are missing
 * @returns {void}
 */
function validateSheetHeaders(sheet, expectedHeaders, sheetName, ssDb, runId) {
    if (!sheet) {
        const msg = `Missing Sheet: "${sheetName}"`;
        logError(ssDb, runId, msg);
        throw new Error(msg);
    }

    // Read header row (Row 1)
    const actualHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const actualMap = mapHeaders(actualHeaders);

    // Extract expected header names (values of the config object)
    const required = Object.values(expectedHeaders).map(h => String(h).trim().toLowerCase());

    const missing = required.filter(req => !actualMap.has(req));

    if (missing.length > 0) {
        const msg = `Schema Validation Failed for "${sheetName}". Missing headers: [${missing.join(', ')}]`;
        logError(ssDb, runId, msg);
        throw new Error(msg);
    }
}

/**
 * Validates schemas for all critical Central DB sheets based on CONFIG.
 * Should be called immediately after DB connection to ensure integrity.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssDb - Central Database
 * @param {string} runId - Execution ID
 * @returns {void}
 */
function validateAllSchemas(ssDb, runId) {
    logInfo(ssDb, runId, "Validating database schema...");

    // 1. Config Sheet
    validateSheetHeaders(
        ssDb.getSheetByName(CONFIG.tabs.config.name),
        CONFIG.tabs.config.h,
        CONFIG.tabs.config.name,
        ssDb,
        runId
    );

    // 2. Rules Sheet
    validateSheetHeaders(
        ssDb.getSheetByName(CONFIG.tabs.rules.name),
        CONFIG.tabs.rules.h,
        CONFIG.tabs.rules.name,
        ssDb,
        runId
    );

    // 3. Decision Matrix
    validateSheetHeaders(
        ssDb.getSheetByName(CONFIG.tabs.decision.name),
        CONFIG.tabs.decision.h,
        CONFIG.tabs.decision.name,
        ssDb,
        runId
    );

    // 4. Ledger
    validateSheetHeaders(
        ssDb.getSheetByName(CONFIG.tabs.ledger.name),
        CONFIG.tabs.ledger.h,
        CONFIG.tabs.ledger.name,
        ssDb,
        runId
    );

    // 5. Leaves
    validateSheetHeaders(
        ssDb.getSheetByName(CONFIG.tabs.leaves.name),
        CONFIG.tabs.leaves.h,
        CONFIG.tabs.leaves.name,
        ssDb,
        runId
    );

    // 6. Holidays
    validateSheetHeaders(
        ssDb.getSheetByName(CONFIG.tabs.holidays.name),
        CONFIG.tabs.holidays.h,
        CONFIG.tabs.holidays.name,
        ssDb,
        runId
    );

    logInfo(ssDb, runId, "Schema validation passed");
}
