# System Architecture


## System Overview

The Workforce Decision Engine is a rule-based scheduling and entitlement resolution system built for Google Apps Script. It processes employee schedules across multiple workspaces, applying business rules to determine final work status and manage entitlement balances.

### Core Design Principles

1. **Decision Matrix Over Code** - Business logic lives in structured lookup tables
2. **Dual-Pass Resolution** - State-changing rules resolve before attribute-changing rules
3. **Deterministic Outcomes** - Priority-based resolution with tiebreakers eliminates ambiguity
4. **Auditability** - Every decision includes a full trace of evaluated rules
5. **Safety First** - Dry-run mode, idempotent writes, and schema validation

---- 
## Google Apps Script Module Model

Google Apps Script uses a flat global namespace rather than a traditional module system.  
All functions in this project share the same runtime scope.

To maintain testability and clarity:

• Pure functions are isolated where possible (e.g. Resolver)
• External services (SpreadsheetApp) are confined to orchestration layers
• A mock Test Harness replicates spreadsheet inputs for unit testing

This document serves as the explicit dependency map for the system.


---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        ENTRY POINT                          │
│                       src/Code.js                           │
│  • Orchestrates execution flow                              │
│  • Time-guard protection (5-min limit)                      │
│  • Multi-workspace iteration                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
│  LOAD CONTEXT   │ │   VALIDATE   │ │ PROCESS WORKSPACE│
│  (Once)         │ │   SCHEMAS    │ │   (Per File)    │
├─────────────────┤ ├──────────────┤ ├─────────────────┤
│ • Rules         │ │ • Headers    │ │ • Parse Roster  │
│ • Matrix        │ │ • Data types │ │ • Resolve Days  │
│ • Ledger        │ │ • Required   │ │ • Write Output  │
│ • Holidays      │ │   fields     │ │ • Update Ledger │
└─────────────────┘ └──────────────┘ └─────────────────┘
```

### Module Responsibilities

#### 1. **Config.js** (Immutable Configuration)
- Centralized, deep-frozen configuration object
- Sheet names, column mappings, validation rules
- Prevents runtime mutation bugs

#### 2. **Engine/Resolver.js** (Core Logic)
- **Primary Function**: `resolveEmployeeDay()`
- Implements dual-pass rule resolution:
  - **Pass 1**: DAY_PATTERN rules (state-changing)
  - **Pass 2**: SHIFT_OVERRIDE rules (attribute-changing)
- Decision matrix lookup with O(1) composite key indexing
- Returns: final status, shift, value, trace, entitlement action

#### 3. **Engine/Rules.js** (Rule Parser)
- Parses schedule rules from central database
- Sorts by priority hierarchy
- Validates rule inputs (sanitation checks)

#### 4. **Engine/WorkspaceProcessor.js** (Orchestration)
- `getActiveWorkspaces()`: Retrieves active workspace IDs
- `processRoster()`: Parses roster sheets and aggregates results
- `processWorkspace()`: Main workspace processing pipeline

#### 5. **Engine/Ledger.js** (Entitlement Management)
- Grant new entitlements (with duplicate checking)
- Revoke stale entitlements (column-scoped writes)
- Idempotent operations to prevent double-counting

#### 6. **Utils/Helpers.js** (Utilities)
- Date handling and parsing
- Header mapping (`mapHeaders()`)
- Output writing utilities

#### 7. **Utils/Logger.js** (Logging)
- Buffered logging system (in-memory accumulation)
- Batch flush to System_Logs sheet
- Reduces API calls by ~40%

#### 8. **Utils/Validation.js** (Pre-flight Checks)
- Schema validation before processing
- Data type checking
- Required field validation

#### 9. **Utils/SchemaValidator.js** (Header Drift Detection)
- Validates column headers against CONFIG
- Detects renamed, moved, or deleted columns
- Fails fast with actionable diagnostics

---

## Data Flow

### Phase 1: Context Loading (One-Time)

```
Central Database
├── Schedule_Rules → Parsed & Sorted by Priority
├── Decision_Matrix → Indexed Map<composite_key, Array<rows>>
├── Entitlement_Ledger → Active records only
├── Leave_Data → Map<employee|date, leave_type>
├── Holidays → Set<date_strings>
└── Shift_Status_Mapping → Map<shift_code, status>
```

**Indexing Strategy**: The decision matrix is pre-indexed using composite keys:
```javascript
key = `${baseFlag}|${ruleFlag}|${holidayFlag}|${reqFlag}`
// Example: "WORK|NONE|TRUE|LEAVE"
```

This enables O(1) lookups during resolution instead of O(n) scans.

### Phase 2: Per-Workspace Processing

```
For Each Workspace:
1. Validate Schema (header drift check)
2. Read Roster Data (batch read)
3. For Each Employee × Date:
   a. Determine base schedule (shift + off-days)
   b. Apply Pass 1: DAY_PATTERN rules (highest priority wins)
   c. Apply Pass 2: SHIFT_OVERRIDE rules (if work day)
   d. Lookup Decision Matrix → final status, shift, value
   e. Run audit verification (mirror check)
   f. Collect entitlement actions
4. Write Daily_Workforce_Status (batch write)
5. Grant new entitlements (duplicate check)
6. Revoke stale entitlements (column-scoped writes)
```

### Phase 3: Completion

- Flush all buffered logs
- Log execution duration
- Toast notification to user

---

## Rule Resolution Logic

### Dual-Pass Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    INPUT: Employee Day                    │
│              (Base Schedule + Off Days)                   │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  PASS 1: DAY_PATTERN Rules (Aggressive - State Changing)  │
│  ───────────────────────────────────────────────────────  │
│  • Can convert WORK → OFF (e.g., holiday override)        │
│  • Can convert OFF → WORK (e.g., extra shift)             │
│  • Highest priority wins                                  │
│  • Tiebreaker: Highest Rule ID                            │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  PASS 2: SHIFT_OVERRIDE Rules (Polite - Attribute Only)   │
│  ───────────────────────────────────────────────────────  │
│  • Only applies if day is currently WORK                  │
│  • Modifies shift time (e.g., 09:00 → 10:00)              │
│  • Cannot turn a work day OFF                             │
│  • Security: Validates shift value is not "OFF"/empty     │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│              DECISION MATRIX LOOKUP                       │
│  Inputs: Base + Rule Impact + Holiday + Request Type      │
│  Outputs: Final Status + Entitlement Action               │
└──────────────────────────────────────────────────────────┘
```

### Priority Resolution

```javascript
// From findWinningRule()
rules
  .filter(r => r.type === type)
  .reduce((prev, curr) => {
    if (curr.prio > prev.prio) return curr;           // Higher priority wins
    if (curr.prio === prev.prio && 
        curr.id.localeCompare(prev.id) > 0) return curr; // Tie: Higher ID wins
    return prev;
  }, { prio: -1, id: '' });
```

**Result**: 100% deterministic outcomes. No ambiguity.

---

## Decision Matrix Structure

### Input Dimensions (4)

| Dimension | Values | Description |
|-----------|--------|-------------|
| **Base** | WORK, OFF, ANY | Base schedule state |
| **Rule** | WORK, OFF, NONE, ANY | Impact of rules applied |
| **Holiday** | TRUE, FALSE, ANY | Is this a public holiday? |
| **Request** | NONE, LEAVE, COMP_DAY, ANY | Employee leave request |

### Output Values (2)

| Output | Description |
|--------|-------------|
| **Final_Status** | WORK, OFF, LEAVE, COMP_DAY, ERROR |
| **Action** | GRANT, REVOKE, NONE |

### Example Walkthrough

**Scenario**: Employee rostered WORK on a Public Holiday, no leave request

```
Lookup Key: "WORK|NONE|TRUE|NONE"

Matrix Match:
┌───────┬──────┬───────┬──────┬─────────────┬────────┬──────────────────┐
│ Base  │ Rule │ PH    │ Req  │ Final_Status│ Action │ Reason           │
├───────┼──────┼───────┼──────┼─────────────┼────────┼──────────────────┤
│ WORK  │ NONE │ TRUE  │ NONE │ WORK        │ GRANT  │ Worked Holiday   │
└───────┴──────┴───────┴──────┴─────────────┴────────┴──────────────────┘

Result:
- Employee WORKS the holiday
- System GRANTS a compensatory day
```

---

## Entitlement Lifecycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   TRIGGER    │────▶│    GRANT     │────▶│    ACTIVE    │
│ (Work Hol/   │     │ (Create      │     │ (Available   │
│  Off Day)    │     │  Ledger Row) │     │  for use)    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   REVOKE     │◀────│  SCHEDULE    │◀────│   CONSUME    │
│ (Delete/     │     │  CHANGE      │     │ (Mark Used)  │
│  Invalidate) │     │ (Roster      │     │              │
│              │     │  Modified)   │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Grant Operation
- Trigger: Employee works on holiday or converted off-day
- Action: Insert new row in Entitlement_Ledger
- Duplicate Check: Prevents double-grants

### Revoke Operation
- Trigger: Schedule change removes qualifying condition
- Action: Update ledger row activation status
- Scope: Column-scoped writes (minimal blast radius)

### Consume Operation
- Trigger: Employee requests COMP_DAY leave
- Action: Mark entitlement as consumed
- Validation: Ensures balance exists before allowing

---

## Performance Optimizations

### 1. Batch Operations

**Before** (Cell-by-cell):
```javascript
// ❌ 365 API calls per employee per year
for (let day of days) {
  sheet.getCell(row, col).setValue(status);
}
```

**After** (Batch):
```javascript
// ✅ 1 API call for all data
sheet.getRange(startRow, startCol, numRows, numCols).setValues(data);
```

### 2. Pre-Indexing

**Before** (Linear scan):
```javascript
// ❌ O(n) for each lookup
matrix.find(row => row.base === b && row.rule === r && ...)
```

**After** (Hash map):
```javascript
// ✅ O(1) lookup
const bucket = matrixIndex.get(`${b}|${r}|${p}|${q}`);
```

### 3. Buffered Logging

**Before** (Immediate write):
```javascript
// ❌ 1 API call per log entry
sheet.appendRow([runId, timestamp, level, message]);
```

**After** (Batch flush):
```javascript
// ✅ 1 API call for all logs
LOG_BUFFER.push([runId, timestamp, level, message]);
// ... at end of run ...
sheet.getRange(lastRow + 1, 1, buffer.length, 5).setValues(LOG_BUFFER);
```

### 4. Execution Time Guard

```javascript
const MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 minutes
const timerStart = new Date();

for (let workspace of workspaces) {
  if ((new Date() - timerStart) > MAX_RUNTIME_MS) {
    // Graceful halt before 6-min platform limit
    logWarn("Time limit reached. Stopping safely...");
    break;
  }
  processWorkspace(workspace);
}
```

---

## Security Considerations

### 1. Input Sanitization

All rule inputs are validated before processing:

```javascript
function audit_inputs(rule) {
  if (rule.type === 'SHIFT_OVERRIDE') {
    // Force String coercion before .trim()
    if (!rule.shift || String(rule.shift).trim() === '') return false;
  }
  return true;
}
```

### 2. SHIFT_OVERRIDE Validation

Prevents malicious or accidental shift overrides:

```javascript
if (isWorkDay) {
  const winningSHIFT = findWinningRule(activeRules, 'SHIFT_OVERRIDE');
  if (winningSHIFT.id) {
    const sShift = String(winningSHIFT.shift || "").toUpperCase().trim();
    // 🛡️ SECURITY: Don't overwrite with "OFF" or empty
    if (sShift !== 'OFF' && sShift !== '') {
      currentShift = winningSHIFT.shift;
    } else {
      currentShift = emp.baseShift; // fallback to safe value
    }
  }
}
```

### 3. Schema Drift Detection

Prevents processing when data structure changes:

```javascript
function validateAllSchemas(ssDb, runId) {
  const errors = [];
  // Check every sheet's headers against CONFIG
  // Fail fast with specific column mismatch details
  if (errors.length > 0) {
    throw new Error(`Schema validation failed: ${errors.join(', ')}`);
  }
}
```

### 4. Idempotent Writes

Every write operation checks existing state:

```javascript
function grantEntitlement(ssDb, empId, date, type) {
  // Check if already exists
  const existing = findExistingGrant(empId, date, type);
  if (existing) {
    logInfo("Duplicate grant prevented");
    return;
  }
  // Proceed with insert
  ledgerSheet.appendRow([...]);
}
```

---

## Testing Architecture

### Mock Layer

The test harness mocks Google Sheets API:

```javascript
function getMockContext() {
  return {
    matrixIndex: new Map(), // In-memory matrix
    rules: new Map(),       // In-memory rules
    holidays: new Set(),    // In-memory holidays
    leaves: new Map(),      // In-memory leave data
    ledger: new Map(),      // In-memory ledger
    mapping: new Map()      // In-memory shift mapping
  };
}
```

### Test Scenarios

1. **Basic Work Day** - Normal schedule resolution
2. **Weekend / Off Day** - RDO (regular day off) logic
3. **Public Holiday (Worked)** - Holiday flag + entitlement grant
4. **Leave Override** - Leave priority over base schedule
5. **Comp Day Consumption** - Ledger debit and status update

---

## Deployment Patterns

### Option A: Manual (No Dev Tools)
- Copy `.gs` files into Apps Script editor
- Configure `Config.gs` with Sheet IDs
- Set `isDryRun: false` for production

### Option B: Developer Workflow (clasp)
- Local editing with version control
- `clasp push` to deploy
- CI/CD integration possible

---

## Platform Constraints

| Constraint | Limit | Mitigation |
|------------|-------|------------|
| Execution Time | 6 minutes | 5-minute self-imposed limit |
| Heap Memory | ~30 MB | Batch processing, no large caches |
| API Quotas | Daily limits | Buffered writes, efficient queries |
| Concurrent Runs | Single-threaded | Queue-based processing |

---

## Future Considerations

### Current Limitation
- **Fixed weekly patterns only** (Mon-Fri, Sat-Sun off)

### Planned Extensions
- **Rotating rosters** (4-on/4-off, Panama schedules)
- **Overtime rule calculations** (1.5x, 2.0x multipliers)
- **Break time compliance** (11-hour rest rules)
- **Financial values** ($ pay calculations)

### Portability
The core resolver (`Engine/Resolver.js`) is platform-agnostic:
- No dependencies on `SpreadsheetApp`
- Pure functions: input data → output decisions
- Can be extracted to Node.js, AWS Lambda, or cloud functions

---

## File Structure

```
src/
├── Code.js                    # Entry point
├── Config.js                  # Deep-frozen configuration
├── Engine/
│   ├── Resolver.js            # Core decision logic
│   ├── Rules.js               # Rule parser
│   ├── WorkspaceProcessor.js  # Multi-workspace orchestration
│   └── Ledger.js              # Entitlement management
└── Utils/
    ├── Helpers.js             # Date, headers, output
    ├── Logger.js              # Buffered logging
    ├── Validation.js          # Pre-flight validation
    └── SchemaValidator.js     # Header drift detection

tests/
└── TestHarness.js             # Server-side unit tests

docs/
└── sample_data/               # Schema definitions & examples
    ├── Daily_Workforce_Status.md
    ├── Workspace_Roster.md
    ├── Decision_Matrix.md
    ├── Schedule_Rules.md
    └── ...
```

---

## Glossary

| Term | Definition |
|------|------------|
| **DAY_PATTERN** | Rule type that changes day state (WORK/OFF) |
| **SHIFT_OVERRIDE** | Rule type that changes shift attributes (time) |
| **Decision Matrix** | Lookup table mapping 4 inputs to 2 outputs |
| **Entitlement** | Compensatory day earned for working holidays/off-days |
| **Dry Run** | Read-only simulation mode |
| **Audit Trace** | Log of all rules evaluated for a decision |
| **Idempotent** | Safe to re-run without side effects |
| **Composite Key** | Combined string key for O(1) lookups |

---

*This architecture is designed for maintainability, auditability, and safe deployment in production workforce management environments.*
