
/**
 * Code.js
 * -------
 * Entry point for the Workforce Decision Engine.
 * 
 * Orchestrates the full workforce scheduling run across all active workspaces.
 * Loads central configuration, processes each workspace, and updates ledger + logs.
 *
 * Side effects:
 * - Reads/writes multiple Google Sheets
 * - Writes to System_Logs sheet
 * - Sends email alerts (if configured - future)
 *
 * @file Code.js
 */

// -----------------------------------------------------------------------------
// 🚀 MASTER EXECUTION (Multi-File Capable)
// -----------------------------------------------------------------------------
/**
 * Master execution function.
 * 
 * Flow:
 * 1. Validates Central DB connection.
 * 2. Loads all context (Rules, Logic, Ledger).
 * 3. Iterates through all "Active" workspaces defined in config.
 * 4. Processes each workspace (Validation -> Roster Parsing -> Logic -> Output).
 * 5. Flushes logs and updates execution duration.
 * 
 * @function runWorkforceEngine
 * @returns {void}
 */
function runWorkforceEngine() {

  if (CONFIG.ids.database.includes('FILE_ID')) {
    throw new Error("Please configure your Central Database Spreadsheet ID before running.");
  }

  /* 
   * SAFETY GUARD: 5-minute execution limit.
   * Apps Script has a hard limit (6-30 min depending on account type).
   * We stop early to ensure logs are flushed and the run finishes cleanly.
   */
  const MAX_RUNTIME_MS = 5 * 60 * 1000;
  const timerStart = new Date();
  const ssDb = SpreadsheetApp.openById(CONFIG.ids.database);
  const runId = generateRunId();

  if (CONFIG.isDryRun) {
    logWarn(ssDb, runId, "Running in DRY RUN mode — no data will be written.");
  }
  logInfo(ssDb, runId, "Workforce engine started");
  validateCentralDatabase(ssDb, runId);
  validateAllSchemas(ssDb, runId); // New Schema Drift Check


  // --- PHASE 1: LOADING CONTEXT (Happens ONLY ONCE) ---
  safeToast(ssDb, "⏳ Phase 1: Loading Central Logic...", "Scheduler Running", -1);
  const ctx = loadContext(ssDb);
  const activeSchedules = getActiveWorkspaces(ssDb); // Get list of files from DB
  if (activeSchedules.length === 0) {
    safeAlert("⚠️ No 'Active' schedules found in Admin_Config tab.");
    flushLogs(ssDb); // Ensure logs are written before exit
    return;
  }
  if (ctx.matrixIndex.size === 0) {
    safeAlert("⚠️ Error: No logic loaded. Check 'Decision_Logic' headers.");
    flushLogs(ssDb); // Ensure logs are written before exit
    return;
  }

  // --- PHASE 2: LOOP THROUGH EACH SCHEDULE FILE ---
  // --- PHASE 2: LOOP THROUGH EACH SCHEDULE FILE ---
  for (let i = 0; i < activeSchedules.length; i++) {
    const schedId = activeSchedules[i];
    const index = i;

    // TIME GUARD CHECK
    if ((new Date() - timerStart) > MAX_RUNTIME_MS) {
      logWarn(ssDb, runId, "⚠️ Execution time limit reached. Stopping gracefully.",
        `Processed ${i}/${activeSchedules.length} workspaces. Rerun to continue.`);
      safeToast(ssDb, "⏳ Time limit reached. Stopping safely...", "Time Guard");
      break;
    }

    try {
      logInfo(ssDb, runId, "Processing workspace", schedId);
      const ssSched = validateWorkspace(ssDb, runId, schedId);

      processWorkspace(ssSched, schedId, ctx, index + 1, activeSchedules.length, ssDb);
    } catch (e) {
      logError(ssDb, runId, e.message, schedId);
      safeToast(ssDb, `❌ Error on File ${index + 1}: ${e.message}`);
    }
  }
  // --- COMPLETE ---
  const timerEnd = new Date();
  const duration = ((timerEnd - timerStart) / 1000).toFixed(1);
  logInfo(ssDb, runId, `Run completed in ${duration}s`);
  flushLogs(ssDb); // Write all buffered logs to the sheet

  safeToast(ssDb, `✅ All Cycles Updated in ${duration}s.`, "Complete", 5);
}