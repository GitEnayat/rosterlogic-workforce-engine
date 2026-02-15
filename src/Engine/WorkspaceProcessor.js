
/**
 * Workspace Processor Module
 * --------------------------
 * Handles the logic for processing individual workspace spreadsheets.
 * Includes fetching active workspaces, parsing rosters, and aggregating results.
 *
 * @file WorkspaceProcessor.js
 */

/**
 * Retrieves a list of active workspace IDs from the Central Database configuration.
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssDb - The Central Database spreadsheet
 * @returns {Array<string>} List of spreadsheet IDs marked as "Active"
 */
function getActiveWorkspaces(ssDb) {
  const sh = ssDb.getSheetByName(CONFIG.tabs.config.name);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  const h = mapHeaders(data[0]);
  const c = CONFIG.tabs.config.h;
  const activeIds = [];
  // Loop rows, check if Status contains "Active"
  for (let i = 1; i < data.length; i++) {
    const status = String(data[i][h.get(c.status.toLowerCase())] || "").toUpperCase();
    const id = String(data[i][h.get(c.id.toLowerCase())] || "").trim();
    // Simple validation: ID must be long enough to be a Google ID
    if (status === "ACTIVE" && id.length > 10) {
      activeIds.push(id);
    }
  }
  return activeIds;
}

//

/**
 * Parses a roster sheet and resolves the schedule for all employees within it.
 *
 * @param {Array<Array<string>>} data - The raw 2D array data from the roster sheet
 * @param {EngineContext} ctx - The preloaded engine context (Logic, Rules, etc.)
 * @returns {{dailyStatus: Array, grants: Array, revocations: Array}} Aggregated results
 */
function processRoster(data, ctx) {
  const dates = data[CONFIG.roster.rows.header - 1];
  const emps = data.slice(CONFIG.roster.rows.data - 1);
  const out = { dailyStatus: [], grants: [], revocations: [] };
  const headerRow = data[CONFIG.roster.rows.header - 1];
  const headerMap = mapHeaders(headerRow);
  const c = CONFIG.roster.cols;

  // Core employee columns
  const idx = {
    emp: headerMap.get(c.employee_id.toLowerCase()),
    base: headerMap.get(c.default_shift.toLowerCase()),
    wo1: headerMap.get(c.primary_off_day.toLowerCase()),
    wo2: headerMap.get(c.secondary_off_day.toLowerCase())
  };

  // Validate required columns
  if ([idx.emp, idx.base, idx.wo1, idx.wo2].some(v => v === undefined)) {
    throw new Error("Roster sheet missing required columns. Check CONFIG.roster.cols");
  }

  // ------------------------------------------------------------------
  // Detect schedule date columns dynamically
  // Any column containing a valid date becomes part of the schedule grid
  // ------------------------------------------------------------------

  const dateColumns = [];

  headerRow.forEach((cell, colIndex) => {
    const d = parseSafeDate(cell);
    if (d) {
      dateColumns.push(colIndex);
    }
  });

  if (dateColumns.length === 0) {
    throw new Error("No date columns detected in roster sheet.");
  }


  const dateMeta = {};

  dateColumns.forEach(colIndex => {
    const d = parseSafeDate(headerRow[colIndex]);
    if (d) {
      dateMeta[colIndex] = {
        obj: d,
        str: formatDate(d),
        day: getDayName(d)
      };
    }
  });



  for (const r of emps) {
    if (!r[idx.emp]) continue;
    const empId = String(r[idx.emp]).trim().toLowerCase();
    const emp = {
      id: empId,
      display: String(r[idx.emp]).trim(),
      baseShift: r[idx.base],
      wo1: normalizeDay(r[idx.wo1]),
      wo2: normalizeDay(r[idx.wo2])
    };
    const rules = ctx.rules.get(emp.id) || [];
    for (const c0 of dateColumns) {
      const meta = dateMeta[c0];
      if (!meta) continue;

      const res = resolveEmployeeDay(emp, meta, ctx, rules);
      out.dailyStatus.push(res.row);
      if (res.entitlementAction === 'GRANT') out.grants.push({ employee: emp.display, date: meta.obj });
      if (res.entitlementAction === 'REVOKE') {
        out.revocations.push({
          employee: emp.display, dateStr: meta.str, reason: res.finalStatus // Pass the status (PO, WORK, etc.)
        });
      }
    }
  }
  return out;
}


/**
 * Loads all central configuration and logic into memory to minimize API calls.
 *
 * Reads:
 * - Status Mapping
 * - Decision Matrix
 * - Entitlement Ledger (Active entitlements only)
 * - Leave Records
 * - Schedule Rules
 * - Holiday List
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssDb - Central Database
 * @returns {EngineContext} The fully loaded context object
 */
function loadContext(ssDb) {
  const mapping = new Map(), matrixIndex = new Map();
  // 1. Mapping
  const mapSh = ssDb.getSheetByName(CONFIG.tabs.mapping.name);
  if (mapSh) {
    const d = mapSh.getDataRange().getValues(), h = mapHeaders(d[0]), c = CONFIG.tabs.mapping.h;
    for (let i = 1; i < d.length; i++) {
      const s = d[i][h.get(c.shift.toLowerCase())];
      if (s) mapping.set(String(s).trim(), String(d[i][h.get(c.status.toLowerCase())]).toUpperCase());
    }
  }
  // 2. Decision Logic
  const mSh = ssDb.getSheetByName(CONFIG.tabs.decision.name);
  if (mSh) {
    const d = mSh.getDataRange().getValues(), h = mapHeaders(d[0]), c = CONFIG.tabs.decision.h;
    for (let i = 1; i < d.length; i++) {
      if (!d[i][h.get(c.base.toLowerCase())]) continue;
      const row = {
        base: String(d[i][h.get(c.base.toLowerCase())]).toUpperCase(),
        rule: String(d[i][h.get(c.rule.toLowerCase())]).toUpperCase(),
        ph: String(d[i][h.get(c.ph.toLowerCase())]).toUpperCase(),
        req: String(d[i][h.get(c.req.toLowerCase())] || 'NONE').toUpperCase(),
        finalStatus: String(d[i][h.get(c.final.toLowerCase())]).toUpperCase(),
        action: String(d[i][h.get(c.action.toLowerCase())]).toUpperCase(),
        reason: String(d[i][h.get(c.reason.toLowerCase())])
      };
      const bases = row.base === 'ANY' || row.base === 'IGNORED' ? ['WORK', 'OFF'] : [row.base];
      const rules = row.rule === 'ANY' || row.rule === 'IGNORED' ? ['WORK', 'OFF', 'NONE'] : [row.rule];
      const phs = row.ph === 'ANY' || row.ph === 'IGNORED' ? ['TRUE', 'FALSE'] : [row.ph];
      const reqs = row.req === 'ANY' || row.req === 'IGNORED' ? ['NONE', 'COMP_DAY', 'LEAVE'] : [row.req];
      for (const b of bases)
        for (const r of rules)
          for (const p of phs)
            for (const q of reqs) {
              const k = `${b}|${r}|${p}|${q}`;
              if (!matrixIndex.has(k)) matrixIndex.set(k, []);
              matrixIndex.get(k).push(row);
            }
    }
  }
  // 3. Ledger
  const ledger = new Map();
  const lSh = ssDb.getSheetByName(CONFIG.tabs.ledger.name);
  if (lSh) {
    const d = lSh.getDataRange().getValues(), h = mapHeaders(d[0]), c = CONFIG.tabs.ledger.h;
    if (h.has(c.employee.toLowerCase()) && h.has(c.entitlementDate.toLowerCase())) {
      for (let i = 1; i < d.length; i++) {
        const dt = parseSafeDate(d[i][h.get(c.entitlementDate.toLowerCase())]); // 🛡️ SECURITY FIX: Check Activation Status. If "Inactive", do not load this entitlement.
        const act = String(d[i][h.get(c.activation.toLowerCase())] || "Active").trim().toUpperCase();
        if (dt && act !== "INACTIVE") {
          const st = String(d[i][h.get(c.status.toLowerCase())]).trim().toUpperCase();
          ledger.set(`${String(d[i][h.get(c.employee.toLowerCase())]).trim().toLowerCase()}|${formatDate(dt)}`, { status: st });
        }
      }
    }
  }


  // 4. Leaves
  const leaves = new Map();
  const lvSh = ssDb.getSheetByName(CONFIG.tabs.leaves.name);

  if (lvSh) {
    const d = lvSh.getDataRange().getValues(),
      h = mapHeaders(d[0]),
      c = CONFIG.tabs.leaves.h;

    if (h.has(c.employee.toLowerCase()) && h.has(c.date.toLowerCase())) {
      for (let i = 1; i < d.length; i++) {
        const dt = parseSafeDate(d[i][h.get(c.date.toLowerCase())]);
        if (dt) {
          leaves.set(
            `${String(d[i][h.get(c.employee.toLowerCase())]).trim().toLowerCase()}|${formatDate(dt)}`,
            d[i][h.get(c.cat.toLowerCase())]
          );
        }
      }
    }
  }


  const rules = parseRules(ssDb.getSheetByName(CONFIG.tabs.rules.name));
  const holidays = parseSimpleList(ssDb.getSheetByName(CONFIG.tabs.holidays.name), CONFIG.tabs.holidays.h.date);
  return { mapping, matrixIndex, ledger, leaves, rules, holidays };
}


/**
 * Orchestrates the processing of a single workspace file.
 * 
 * 1. Opens the file (passed as object)
 * 2. Iterates through all Roster tabs
 * 3. Calculates daily status for every employee
 * 4. Writes results to "Daily_Workforce_Status"
 * 5. Queues Ledger updates (Grants/Revocations) for the Central DB
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssSched - The open workspace spreadsheet
 * @param {string} schedId - The workspace file ID (for logging)
 * @param {EngineContext} ctx - The engine context
 * @param {number} currentNum - Current file index (1-based)
 * @param {number} totalNum - Total files
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssDb - Central DB (for logging/ledger)
 * @returns {void}
 */
function processWorkspace(ssSched, schedId, ctx, currentNum, totalNum, ssDb) {
  // const ssSched = SpreadsheetApp.openById(schedId); // NOW PASSED IN
  const fileName = ssSched.getName();
  safeToast(ssDb, `📖 Processing File ${currentNum}/${totalNum}: "${fileName}"...`, "Scheduler Running", -1);
  console.log(`Starting File: ${fileName} (${schedId})`);
  let rows = [], grants = [], revocations = [];
  // 1. Process Roster Tabs
  CONFIG.roster.tabs.forEach(t => {
    const sh = ssSched.getSheetByName(t);
    if (!sh) return;
    // Read entire sheet at once
    const fullData = sh.getDataRange().getValues();
    // CALLS THE EXISTING FUNCTION (DO NOT DELETE IT!)
    const res = processRoster(fullData, ctx);
    rows.push(...res.dailyStatus);
    grants.push(...res.grants);
    revocations.push(...res.revocations);
  });
  // 2. Write Dashboard (Daily Status)
  if (rows.length > 0) {
    writeDailyOutput(ssSched, rows);
  }
  SpreadsheetApp.flush();
  // 3. Update Ledger (Central DB)
  if (grants.length || revocations.length) {
    safeToast(ssDb, `💾 Updating Ledger for "${fileName}"...`, "Scheduler Running", -1);
    if (grants.length) grantEntitlements(ssDb, grants);
    if (revocations.length) revokeLedger(ssDb, revocations);
    SpreadsheetApp.flush();
  }
  console.log(`Finished File: ${fileName}`);
}

