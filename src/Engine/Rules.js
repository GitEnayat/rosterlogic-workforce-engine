
/**
 * Rules Module
 * ------------
 * Parses and indexes the scheduling rules from the Central DB.
 * 
 * Rules are loaded into a Map<EmployeeID, Rule[]> structure.
 * 
 * @file Rules.js
 */

/**
 * Reads and parses rules from the Rules sheet.
 * Filters for 'Approved' status only.
 * Sorts rules by Priority and Specificity.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sh - The Rules sheet
 * @returns {Map<string, Array<Rule>>} Map of Employee ID -> Array of Rule objects
 */
function parseRules(sh) {
    const m = new Map();
    if (!sh) return m;
    const d = sh.getDataRange().getValues(), h = mapHeaders(d[0]), c = CONFIG.tabs.rules.h;
    if (!h.has(c.status.toLowerCase())) return m;
    for (let i = 1; i < d.length; i++) {
        const r = d[i];
        if (String(r[h.get(c.status.toLowerCase())]).toUpperCase().includes('APPROVED')) {
            const employee = String(r[h.get(c.employee.toLowerCase())]).trim().toLowerCase();
            const st = parseSafeDate(r[h.get(c.start.toLowerCase())]);
            if (employee && st) {
                if (!m.has(employee)) m.set(employee, []);
                m.get(employee).push({
                    id: r[h.get(c.id.toLowerCase())],
                    type: String(r[h.get(c.type.toLowerCase())] || "SHIFT_OVERRIDE").toUpperCase().trim(),
                    start: formatDate(st),
                    end: formatDate(parseSafeDate(r[h.get(c.end.toLowerCase())]) || st),
                    shift: r[h.get(c.shift.toLowerCase())],
                    wo1: r[h.get(c.wo1.toLowerCase())],
                    wo2: r[h.get(c.wo2.toLowerCase())],
                    freq: String(r[h.get(c.freq.toLowerCase())] || "ALL").toUpperCase(),
                    prio: Number(r[h.get(c.prio.toLowerCase())]) || 0,
                });
            }
        }
    }
    // ---------------------------------------------------------
    // ⚡ STRICT HIERARCHY SORT
    // Order: Day Pattern > Shift Override | Specific > General | Priority High > Low
    // ---------------------------------------------------------
    m.forEach(rulesArray => {
        rulesArray.sort((a, b) => {
            // 1. TYPE: WO (Aggressive) must be processed BEFORE SHIFT (Polite)
            const typeA = a.type === 'DAY_PATTERN' ? 0 : 1;
            const typeB = b.type === 'DAY_PATTERN' ? 0 : 1;
            if (typeA !== typeB) return typeA - typeB;
            // 2. FREQUENCY: Specific Date (0) takes precedence over ALL (1)
            const freqA = (a.freq !== 'ALL') ? 0 : 1;
            const freqB = (b.freq !== 'ALL') ? 0 : 1;
            if (freqA !== freqB) return freqA - freqB;
            // 3. PRIORITY: 10 (High) -> 1 (Low)
            // We process High Priority first so we can 'lock' the state (First-Win strategy)
            if (a.prio !== b.prio) return b.prio - a.prio;
            // 4. TIE-BREAKER: Deterministic by ID
            return a.id.localeCompare(b.id);
        });
    });
    return m;
}