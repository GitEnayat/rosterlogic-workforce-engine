/**
 * Entitlement Ledger Module
 * -------------------------
 * Manages the accrual (Grant) and consumption (Revocation) of time-off entitlements.
 *
 * Concepts:
 * - Grants: Adding a new entitlement record (e.g. working on a Public Holiday).
 * - Revocations: Marking an entitlement as CONSUMED or REVOKED.
 *
 * @file Ledger.js
 */

/**
 * Grants new entitlements to employees in the Central DB Ledger.
 * Adds rows with status "Active".
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssDb - Central Database
 * @param {Array<{employee: string, date: Date}>} grants - List of grant objects
 * @returns {void}
 */
function grantEntitlements(ssDb, grants) {
  if (CONFIG.isDryRun) {
    console.log("DRY RUN: Skipping grantEntitlements()");
    return;
  }

  const sh = ssDb.getSheetByName(CONFIG.tabs.ledger.name);
  if (!sh) return;
  const d = sh.getDataRange().getValues(), h = mapHeaders(d[0]), c = CONFIG.tabs.ledger.h;
  const existing = new Set();
  if (h.has(c.employee.toLowerCase()) && h.has(c.entitlementDate.toLowerCase())) {
    for (let i = 1; i < d.length; i++) {
      const l = String(d[i][h.get(c.employee.toLowerCase())]).trim().toLowerCase();
      const dt = parseSafeDate(d[i][h.get(c.entitlementDate.toLowerCase())]);
      if (l && dt) existing.add(`${l}|${formatDate(dt)}`);
    }
  }
  const adds = [];
  const now = new Date();
  grants.forEach(g => {
    const k = `${String(g.employee).trim().toLowerCase()}|${formatDate(g.date)}`;
    if (!existing.has(k)) {
      const row = new Array(d[0].length).fill("");
      if (h.has("timestamp")) row[h.get("timestamp")] = now;
      if (h.has(c.employee.toLowerCase())) row[h.get(c.employee.toLowerCase())] = g.employee;
      if (h.has(c.entitlementDate.toLowerCase())) row[h.get(c.entitlementDate.toLowerCase())] = g.date;
      if (h.has(c.entitlement.toLowerCase())) row[h.get(c.entitlement.toLowerCase())] = "COMP_DAY";
      if (h.has(c.activation.toLowerCase())) row[h.get(c.activation.toLowerCase())] = "Active";
      adds.push(row);
      existing.add(k);
    }
  });
  if (adds.length) sh.getRange(sh.getLastRow() + 1, 1, adds.length, adds[0].length).setValues(adds);
}

/**
 * Revokes or consumes existing entitlements in the Central DB Ledger.
 * Updates the row to "Inactive" and sets the Snapshot Status (CONSUMED/REVOKED).
 *
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ssDb - Central Database
 * @param {Array<{employee: string, dateStr: string, reason: string}>} revocations - List of revocation objects
 * @returns {void}
 */
function revokeLedger(ssDb, revocations) {
  if (CONFIG.isDryRun) {
    console.log("DRY RUN: Skipping revokeLedger()");
    return;
  }



  const sh = ssDb.getSheetByName(CONFIG.tabs.ledger.name);
  if (!sh) return;
  // 1. Read Data (Values only) to find matches
  const data = sh.getDataRange().getValues();
  const h = mapHeaders(data[0]), c = CONFIG.tabs.ledger.h;
  const idx = {
    employee: h.get(c.employee.toLowerCase()),
    date: h.get(c.entitlementDate.toLowerCase()),
    act: h.get(c.activation.toLowerCase()),
    note: h.get(c.scriptNote.toLowerCase())
  };
  if ([idx.employee, idx.date, idx.act].some(i => i === undefined)) return;
  // Map Key -> Reason
  const revokeMap = new Map(revocations.map(r => [`${String(r.employee).trim().toLowerCase()}|${r.dateStr}`, r.reason]));
  // 2. Prepare Column Buffers (To write back ONLY specific columns)
  // We extract just the columns we intend to modify
  const actCol = data.map(r => [r[idx.act]]);
  const noteCol = (idx.note !== undefined) ? data.map(r => [r[idx.note]]) : [];
  let hasChanges = false;
  for (let i = 1; i < data.length; i++) {
    const l = String(data[i][idx.employee]).trim().toLowerCase();
    const dt = parseSafeDate(data[i][idx.date]);
    if (!l || !dt) continue;
    const key = `${l}|${formatDate(dt)}`;
    // Check if in map AND currently Active
    if (revokeMap.has(key) && String(data[i][idx.act]) !== "Inactive") {
      // Update the Buffer, NOT the main data array
      actCol[i][0] = "Inactive";
      if (idx.note !== undefined) {
        noteCol[i][0] = (revokeMap.get(key) === "COMP_DAY") ? "Comp Day Consumed" : "Revoked: Work/Rule Change";
      }
      hasChanges = true;
    }
  }
  // 3. Write Back ONLY the Modified Columns
  if (hasChanges) {
    // Write Activation Column
    sh.getRange(1, idx.act + 1, actCol.length, 1).setValues(actCol);
    // Write Note Column (if exists)
    if (idx.note !== undefined && noteCol.length > 0) {
      sh.getRange(1, idx.note + 1, noteCol.length, 1).setValues(noteCol);
    }
  }
}

