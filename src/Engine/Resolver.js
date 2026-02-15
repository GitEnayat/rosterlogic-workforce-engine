/**
 * Resolver Module
 * ----------------
 * Contains the core decision engine that determines the final
 * work status and shift for each employee/day combination.
 *
 * This is the "brain" of the workforce engine, resolving conflicts
 * between base schedules, rules, holidays, and entitlement logic.
 *
 * @file Resolver.js
 */

/**
 * @typedef {Object} Employee
 * @property {string} id - Unique employee ID (lowercase, trimmed)
 * @property {string} display - Display name
 * @property {string} baseShift - Default shift string (e.g. "09:00 - 18:00")
 * @property {string} wo1 - Primary off day (3-letter, e.g. "SUN")
 * @property {string} wo2 - Secondary off day (3-letter, e.g. "MON")
 */

/**
 * @typedef {Object} DayMeta
 * @property {Date} obj - Date object
 * @property {string} str - Date string YYYY-MM-DD
 * @property {string} day - Day name (3-letter, e.g. "MON")
 */

/**
 * @typedef {Object} Rule
 * @property {string} id - Rule ID
 * @property {string} type - Rule type (DAY_PATTERN | SHIFT_OVERRIDE)
 * @property {string} start - Start YYYY-MM-DD
 * @property {string} end - End YYYY-MM-DD
 * @property {string} shift - Shift string or ""
 * @property {string} wo1 - Off day 1
 * @property {string} wo2 - Off day 2
 * @property {string} freq - Frequency (ALL or comma-separated days)
 * @property {number} prio - Priority (higher wins)
 */

/**
 * @typedef {Object} DecisionMatrixRow
 * @property {string} base - Base condition (WORK/OFF/ANY)
 * @property {string} rule - Rule condition (WORK/OFF/NONE/ANY)
 * @property {string} ph - Holiday condition (TRUE/FALSE/ANY)
 * @property {string} req - Request condition (NONE/LEAVE/COMP_DAY/ANY)
 * @property {string} finalStatus - Resulting status
 * @property {string} action - Ledger action (GRANT/REVOKE/NONE)
 * @property {string} reason - Human-readable reason
 */

/**
 * @typedef {Object} EngineContext
 * @property {Map<string, string>} mapping - Shift code to Status mapping
 * @property {Map<string, Array<DecisionMatrixRow>>} matrixIndex - Indexed decision matrix
 * @property {Map<string, Object>} ledger - Entitlement ledger state
 * @property {Map<string, string>} leaves - Leave records
 * @property {Map<string, Array<Rule>>} rules - Employee rules
 * @property {Set<string>} holidays - Holiday date strings
 */

/**
 * Resolves the final workforce status for a single employee on a single day.
 *
 * Resolution hierarchy:
 * 1) Base roster
 * 2) DAY_PATTERN rules (state-changing, aggressive)
 * 3) SHIFT_OVERRIDE rules (attribute-changing, polite)
 * 4) Leave / Holiday / Entitlement inputs
 * 5) Decision matrix lookup
 *
 * @param {Employee} emp - Employee base data and default shift.
 * @param {DayMeta} meta - Date metadata (date object, string, weekday).
 * @param {EngineContext} ctx - Preloaded context (rules, ledger, holidays, matrix).
 * @param {Array<Rule>} rules - Active rules for the employee.
 * @returns {{row: Array, entitlementAction: string, finalStatus: string}} The resolution result including audit trace row and ledger actions.
 */
function resolveEmployeeDay(emp, meta, ctx, rules) {
  const key = `${emp.id}|${meta.str}`;
  let trace = [];
  // 1. Establish Base State
  const baseOff = meta.day === emp.wo1 || meta.day === emp.wo2;
  const baseIsWork = !baseOff && emp.baseShift !== 'OFF';
  let isWorkDay = baseIsWork;
  let currentShift = baseIsWork ? emp.baseShift : 'OFF';
  trace.push(`[BASE:${baseIsWork ? 'WORK' : 'OFF'}:${currentShift}]`);
  // 2. Filter Active Rules & Apply Audit
  const activeRules = rules.filter(r =>
    meta.str >= r.start && meta.str <= r.end &&
    (r.freq === 'ALL' || r.freq.includes(meta.day)) &&
    audit_inputs(r) // Step 4: Input Sanitation
  );
  // --- PASS 1: WO RULES (Aggressive - Sets the State) ---
  // LOGIC: Highest Prio Wins. If Tie, Higher ID Wins.
  const winningWO = findWinningRule(activeRules, 'DAY_PATTERN');
  // --- PASS 1: WO RULES (Aggressive - Sets the State) ---
  if (winningWO.id) {
    const isRuleOff = (meta.day === normalizeDay(winningWO.wo1) || meta.day === normalizeDay(winningWO.wo2));
    if (isRuleOff) {
      isWorkDay = false;
      currentShift = 'OFF';
    } else {
      isWorkDay = true;
      const ruleShiftStr = String(winningWO.shift || "").toUpperCase().trim();
      const isInvalidShift = ruleShiftStr === 'OFF' || ruleShiftStr === '';
      if (!isInvalidShift) {
        currentShift = winningWO.shift;
      } else {
        if (currentShift === 'OFF') {
          // Fix for the Wed/Thu WO scenario where Mon is work but Shift is empty/OFF
          currentShift = (emp.baseShift !== 'OFF') ? emp.baseShift : "09:00 - 18:00";
          trace.push(`[FIX:AppliedFallback]`);
        }
      }
    }
    trace.push(`[DAY_PATTERN:${winningWO.id}:${currentShift}:P${winningWO.prio}]`);
  }
  // --- PASS 2: SHIFT RULES (Polite - Applies Attribute) ---
  // Can ONLY apply if the day is currently WORK
  if (isWorkDay) {
    const winningSHIFT = findWinningRule(activeRules, 'SHIFT_OVERRIDE');
    if (winningSHIFT.id) {
      // 🛡️ SECURITY FIX: Do not let a SHIFT rule overwrite a valid shift with "OFF"
      const sShift = String(winningSHIFT.shift || "").toUpperCase().trim();
      if (sShift !== 'OFF' && sShift !== '') {
        currentShift = winningSHIFT.shift;
        trace.push(`[SHIFT:${winningSHIFT.id}:${winningSHIFT.shift}:P${winningSHIFT.prio}]`);
      } else {
        currentShift = emp.baseShift; // fallback to safe shift
        trace.push(`[SHIFT:FALLBACK_BASE:${winningSHIFT.id}]`);
      }
    }
  }


  // --- MATRIX LOOKUP ---
  const derivedFlag = isWorkDay ? 'WORK' : 'OFF';
  const baseFlag = baseIsWork ? 'WORK' : 'OFF';
  const ruleFlag = (derivedFlag === baseFlag) ? 'NONE' : derivedFlag;
  const holidayFlag = ctx.holidays.has(meta.str) ? 'TRUE' : 'FALSE';

  let reqFlag = 'NONE';
  let leave = 'NONE';
  let entitlement = 'NONE';

  // Leave input
  const lv = ctx.leaves.get(key);
  if (lv) {
    reqFlag = 'LEAVE';
    leave = lv;
  }

  // Entitlement input (Comp Day / future credits)
  const led = ctx.ledger.get(key);
  if (led && (led.status === 'COMP_DAY' || led.status === 'OFF')) {
    entitlement = led.status;
    if (reqFlag === 'NONE') reqFlag = 'COMP_DAY';
  }

  // Lookup decision matrix
  const bucket = ctx.matrixIndex.get(`${baseFlag}|${ruleFlag}|${holidayFlag}|${reqFlag}`) || [];
  let match = null;

  for (const row of bucket) {
    if (
      checkMatch(row.base, baseFlag) &&
      checkMatch(row.rule, ruleFlag) &&
      checkMatch(row.ph, holidayFlag) &&
      checkMatch(row.req, reqFlag)
    ) {
      match = row;
      break;
    }
  }

  // If no decision found → error row
  if (!match) {
    return {
      row: createErrorRow(emp, meta, baseFlag, baseIsWork ? emp.baseShift : 'OFF', currentShift, leave, holidayFlag, entitlement, 'Missing Logic'),
      entitlementAction: 'NONE',
      finalStatus: 'ERROR'
    };
  }

  let finalStatus = match.finalStatus;
  if (finalStatus === 'LEAVE') finalStatus = leave;


  // --- FINAL VALUE CALCULATION (Float64 Strict) ---
  let finalShift = "";
  let finalVal = 0.0;

  if (finalStatus === 'WORK') {
    finalShift = currentShift;
    finalVal = (currentShift === 'HAL1' || currentShift === 'HAL2') ? 0.5 : 1.0;
  }
  else if (finalStatus === 'COMP_DAY') {
    finalShift = 'OFF';
    finalVal = 1.0;
  }
  else {
    finalShift = 'OFF';
    finalVal = 0.0;
  }

  // --- MIRROR AUDIT ---
  const auditErr = verifyShiftOverride(isWorkDay, finalShift, activeRules);
  const reasonOut = auditErr ? auditErr : match.reason;
  return {
    row: [
      key,
      emp.display,
      meta.obj,
      baseFlag,
      baseIsWork ? emp.baseShift : 'OFF',
      currentShift,
      leave,
      holidayFlag,
      entitlement,
      finalStatus,
      finalShift,
      reasonOut,
      trace.join(' | '),
      finalVal
    ],
    entitlementAction: match.action, finalStatus: finalStatus
  };
}


/**
 * Verifies if the final shift matches the expected shift from rules.
 * This acts as a "Mirror Audit" to ensure logic parity.
 *
 * @param {boolean} isWorkDay - Is the day ultimately a work day?
 * @param {string} finalShift - The final calculated shift string
 * @param {Array<Rule>} activeRules - The list of active rules for this day
 * @returns {string|null} Error string if audit fails, or null if pass
 */
function verifyShiftOverride(isWorkDay, finalShift, activeRules) {
  if (!isWorkDay) return null;
  // We must replicate the exact .reduce() logic from resolveEmployeeDay to ensure parity.
  const winningSHIFT = findWinningRule(activeRules, 'SHIFT_OVERRIDE');
  // If a valid SHIFT rule won, the final output MUST match it
  if (winningSHIFT.id && winningSHIFT.shift) {
    // Exception: LEAVE and PO statuses override Shift rules
    if (
      finalShift !== winningSHIFT.shift &&
      finalShift !== 'LEAVE' &&
      finalShift !== 'COMP_DAY' &&
      finalShift !== 'OFF'
    ) {

      return `⚠️ AUDIT FAIL: Exp "${winningSHIFT.shift}" (Rule ${winningSHIFT.id}) but got "${finalShift}"`;
    }
  }
  return null;
}

/**
 * Validates rule inputs (sanitation).
 *
 * @param {Rule} rule - The rule object to check
 * @returns {boolean} True if valid, false if corrupted/incomplete
 */
function audit_inputs(rule) {
  // 1. SHIFT Rules: MUST have a value in the 'SHIFT_OVERRIDE' column.
  if (rule.type === 'SHIFT_OVERRIDE') {
    // 🛡️ SECURITY FIX: Force String coercion before .trim() to handle Numbers/Dates safely
    if (!rule.shift || String(rule.shift).trim() === '') return false;
  }
  // 2. DAY_PATTERN rules may omit shift (fallback to base shift)
  // but if it doesn't, we allow it (it falls back to Base Shift).
  // We only fail if the data structure is corrupted (e.g. missing critical keys).
  if (rule.type === 'DAY_PATTERN') {
    // A WO rule without parameters is effectively useless, but not dangerous.
    // We allow it to pass to let the logic handle the fallback.
    return true;
  }
  return true;
}

/**
 * Creates a fallback error row when logic fails.
 *
 * @param {Employee} emp - Employee object
 * @param {DayMeta} meta - Date metadata
 * @param {string} b - Base status
 * @param {string} bs - Base shift
 * @param {string} r - Rule shift
 * @param {string} l - Leave input
 * @param {string} p - Holiday input
 * @param {string} po - Entitlement input
 * @param {string} err - Error reason
 * @returns {Array} The error row for the output sheet
 */
function createErrorRow(emp, meta, b, bs, r, l, p, po, err) {
  return [
    `${emp.id}|${meta.str}`,
    emp.display,
    meta.obj,
    b,
    bs,
    r,
    l,
    p,
    po,
    "ERROR",        // Final_Status
    "",             // Final_Shift
    err,            // Reason
    "ERROR_TRACE",  // Trace placeholder
    0               // Final_Val
  ];
}

/**
 * Helper to find the winning rule based on Priority > ID.
 * Refactored to DRY out the .reduce() logic.
 *
 * @param {Array<Rule>} rules - Candidate rules
 * @param {string} type - Rule type to filter by (DAY_PATTERN | SHIFT_OVERRIDE)
 * @returns {Rule} The winning rule or an empty placeholder object
 */
function findWinningRule(rules, type) {
  return rules
    .filter(r => r.type === type)
    .reduce((prev, curr) => {
      if (prev.prio === -1) return curr;
      if (curr.prio > prev.prio) return curr;
      // Tie-breaker: Deterministic by ID (Higher ID wins)
      if (curr.prio === prev.prio && curr.id.localeCompare(prev.id) > 0) return curr;
      return prev;
    }, { prio: -1, id: '' });
}