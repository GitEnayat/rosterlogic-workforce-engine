/**
 * Test Harness Module
 * -------------------
 * Independent test runner for the Workforce Decision Engine logic.
 * Mocks all spreadsheet inputs and validates the core business logic (Resolver.js).
 * 
 * To run: Select `runAllTests` in the Apps Script editor and view Execution Log.
 * 
 * @file TestHarness.js
 */

/**
 * Runs all defined unit tests and logs the results.
 */
function runAllTests() {
    console.log("🚀 Starting Unit Test Suite...");
    const start = new Date();

    try {
        test_resolveEmployeeDay_basicWorkday();
        test_resolveEmployeeDay_weekOff();
        test_resolveEmployeeDay_publicHoliday();
        test_resolveEmployeeDay_leave();
        test_resolveEmployeeDay_compDay();

        console.log(`✅ ALL TESTS PASSED in ${(new Date() - start)}ms`);
        console.log("🎉 Test Harness completed successfully.");
    } catch (e) {
        console.error(`❌ TEST FAILED: ${e.message}`);
    }
}

/**
 * Mocks the Engine Context with a minimal Decision Matrix.
 */
function getMockContext() {
    const matrixIndex = new Map();

    const addRow = (b, r, p, q, final, action) => {
        const k = `${b}|${r}|${p}|${q}`;
        if (!matrixIndex.has(k)) matrixIndex.set(k, []);
        matrixIndex.get(k).push({
            base: b, rule: r, ph: p, req: q,
            finalStatus: final, action: action, reason: "Mock Rule"
        });
    };

    addRow("WORK", "NONE", "FALSE", "NONE", "WORK", "NONE");
    addRow("OFF", "NONE", "FALSE", "NONE", "OFF", "NONE");
    addRow("WORK", "NONE", "TRUE", "NONE", "WORK", "GRANT");
    addRow("ANY", "ANY", "ANY", "LEAVE", "LEAVE", "NONE");
    addRow("WORK", "NONE", "FALSE", "COMP_DAY", "COMP_DAY", "REVOKE");

    return {
        matrixIndex: matrixIndex,
        rules: new Map(),
        holidays: new Set(),
        leaves: new Map(),
        ledger: new Map(),
        mapping: new Map()
    };
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(`${msg} | Expected: ${expected}, Actual: ${actual}`);
    }
    console.log(`  ✓ PASS: ${msg}`);
}

// -----------------------------------------------------------------------------
// TEST CASES
// -----------------------------------------------------------------------------

function test_resolveEmployeeDay_basicWorkday() {
    console.log("\n[TEST] Basic Work Day Resolution");
    const ctx = getMockContext();

    const emp = {
        id: "test-user",
        display: "Test User",
        baseShift: "09:00-18:00",
        wo1: "SAT",
        wo2: "SUN"
    };

    const meta = { str: "2025-02-03", day: "MON", obj: new Date("2025-02-03") };

    const res = resolveEmployeeDay(emp, meta, ctx, []);

    assertEqual(res.finalStatus, "WORK", "Status should be WORK");
    assertEqual(res.entitlementAction, "NONE", "No entitlement action expected");
}

function test_resolveEmployeeDay_weekOff() {
    console.log("\n[TEST] Weekend / Off Day Resolution");
    const ctx = getMockContext();

    const emp = {
        id: "test-user",
        display: "Test User",
        baseShift: "09:00-18:00",
        wo1: "SAT",
        wo2: "SUN"
    };

    const meta = { str: "2025-02-02", day: "SUN", obj: new Date("2025-02-02") };

    const res = resolveEmployeeDay(emp, meta, ctx, []);

    assertEqual(res.finalStatus, "OFF", "Status should be OFF");
}

function test_resolveEmployeeDay_publicHoliday() {
    console.log("\n[TEST] Public Holiday Resolution (Work on PH)");
    const ctx = getMockContext();
    ctx.holidays.add("2025-12-25");

    const emp = {
        id: "test-user",
        display: "Test User",
        baseShift: "09:00-18:00",
        wo1: "SAT",
        wo2: "SUN"
    };

    const meta = { str: "2025-12-25", day: "THU", obj: new Date("2025-12-25") };

    const res = resolveEmployeeDay(emp, meta, ctx, []);

    assertEqual(res.finalStatus, "WORK", "Status should be WORK (on Holiday)");
    assertEqual(res.entitlementAction, "GRANT", "Should GRANT entitlement");
}

function test_resolveEmployeeDay_leave() {
    console.log("\n[TEST] Leave Override Resolution");
    const ctx = getMockContext();

    ctx.leaves.set(`test-user|2025-03-10`, "ANNUAL_LEAVE");

    const emp = {
        id: "test-user",
        display: "Test User",
        baseShift: "09:00-18:00",
        wo1: "SAT",
        wo2: "SUN"
    };

    const meta = { str: "2025-03-10", day: "MON", obj: new Date("2025-03-10") };

    const res = resolveEmployeeDay(emp, meta, ctx, []);

    assertEqual(res.finalStatus, "LEAVE", "Status should be LEAVE");
}

function test_resolveEmployeeDay_compDay() {
    console.log("\n[TEST] Comp Day Usage Resolution");
    const ctx = getMockContext();

    // Simulate a Comp Day request via leave input.
    // Decision matrix: WORK | NONE | FALSE | COMP_DAY → COMP_DAY + REVOKE
    ctx.leaves.set(`test-user|2025-04-01`, "COMP_DAY");

    const emp = {
        id: "test-user",
        display: "Test User",
        baseShift: "09:00-18:00",
        wo1: "SAT",
        wo2: "SUN"
    };

    const meta = { str: "2025-04-01", day: "TUE", obj: new Date("2025-04-01") };

    const res = resolveEmployeeDay(emp, meta, ctx, []);

    assertEqual(res.finalStatus, "COMP_DAY", "Status should be COMP_DAY");
    if (res.entitlementAction.includes("REVOKE")) {
        console.log("  ✓ PASS: Entitlement Revocation Triggered");
    } else {
        throw new Error("Expected REVOKE action");
    }
}
