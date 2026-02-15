<div align="center">

# ⚙️ Rosterlogic/ Workforce Engine

**A rule-based scheduling and entitlement engine for distributed workforce operations.**

Decision-matrix architecture · Dual-pass rule resolution · Multi-workspace orchestration · Full audit trace

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Google Apps Script](https://img.shields.io/badge/Platform-Google%20Apps%20Script-4285F4.svg)](https://developers.google.com/apps-script)
[![Status: Production](https://img.shields.io/badge/Status-Production-green.svg)]()
[![Tests: Passing](https://img.shields.io/badge/Tests-Passing-green.svg)]()
[![Documentation: 100%](https://img.shields.io/badge/JSDoc-100%25-blue.svg)]()

</div>

---

## Why This Exists

Managing schedules for a distributed workforce is deceptively complex. A single missed rule can cascade into incorrect pay, wrong shifts, or broken entitlement balances — problems that are hard to detect and expensive to fix.

**This project was created from hands-on Workforce Planning & Scheduling experience to automate real rostering workflows.** It serves as a reference implementation for rule-driven scheduling using Google Apps Script.

Consider the real-world inputs the system must reconcile for **every employee, on every day**:

- Shift patterns that change by employee, date range, and day of week
- Public holidays that convert work days into paid off-days
- Leave requests that interact with entitlement balances
- Compensatory day accrual and consumption with audit requirements
- Multiple workspace files, each containing independent rosters

This is a combinatorial problem. No manual process, formula grid, or ad-hoc script can solve it reliably at scale.

**The Workforce Decision Engine replaces all of that with a single deterministic pipeline.** Business logic lives in a decision matrix — a structured lookup table that non-engineers can read and modify. A priority-based rule resolver applies that logic across every workspace, and writes auditable results with full trace information.

> [!NOTE]
> This system runs entirely within **Google Apps Script** (serverless) and interacts directly with Google Sheets. No external servers, databases, or infrastructure are required.

---

## 🏗️ Built for the Real World

This project was designed by a Workforce Management (WFM) professional to solve the specific frustrations of scheduling distributed teams. It moves beyond simple "roster filling" to handle the complex intersection of **HR policy** and **operational reality**.

While the included policies (in `docs/sample_data`) are generalised examples, the architecture is deliberately **policy-agnostic** and can be adapted for:
- **Retail:** Managing store rosters, peak-season casuals, and overtime rules.
- **Healthcare:** Ward shifts, on-call allowances, and public holiday accruals.
- **Logistics:** Driver run patterns and fatigue management rules.
- **Contact Centres:** Agent shift bids and shrinking availability.

Any industry with shift-based work and complex entitlement rules can use this engine as its core resolution logic.

---

## 🧩 The Workforce Tech Ecosystem

It is important to clarify where this project sits in the HR technology stack.

- **This is NOT:** A full-stack employee application (e.g., mobile app, leave portal, shift bidding UI).
- **This IS:** The **decision & policy engine** that sits behind those interfaces.

Many workforce products focus heavily on UI, forms, and data storage, yet still require a robust logic layer to determine outcomes. This project focuses entirely on that layer: **policy modelling, rule resolution, and scheduling mathematics.**

By separating policy logic from application code, organisations gain:
1. **Agility:** HR policies change faster than software release cycles.
2. **Auditability:** Every decision is traced and logged, independent of the UI.
3. **Consistency:** The same rules apply whether the request comes from a mobile app, a web portal, or a manager's spreadsheet.

---

## 📐 Core Concepts & Terminology

To understand how the engine makes decisions, it helps to know the WFM concepts it models.

### 1. Rule Types: State vs. Attribute
The engine uses a **dual-pass resolution** model to prevent conflicts:
- **DAY_PATTERN (Pass 1):** Defines the *State* of the day (WORK vs OFF). This is aggressive — it can turn a work day into an off day (e.g. "I work Mon-Fri") or vice versa.
- **SHIFT_OVERRIDE (Pass 2):** Defines the *Attributes* of the day (09:00 vs 10:00). This is polite — it only applies if the day is already a WORK day. It cannot turn a work day off.

### 2. The Decision Matrix
This is the outcome lookup table. It takes 4 inputs and produces 2 outputs:
* **Inputs:** Base Schedule + Rule Impact + Holiday Flag + Request Type
* **Outputs:** Final Status + Entitlement Action

**Example Walkthrough:**
> *Comparison:* "Employee is rostered to work (Base), no rules apply (Rule), today is a Public Holiday (Holiday), and they haven't requested leave (Request)."
>
> **Matrix Lookup:** `WORK` + `NONE` + `TRUE` + `NONE`
>
> **Result:**
> - **Final Status:** `WORK` (They are working the holiday)
> - **Action:** `GRANT` (They earn a compensatory day)

### 3. Entitlement Lifecycle (Grant / Revoke)
Most scripts just "add" a day. This engine manages the full lifecycle:
- **GRANT:** Detecting a trigger (e.g. working a holiday) and creating a new `Active` record in the `Entitlement_Ledger`.
- **CONSUME:** When an employee uses that day later, the system detects a `COMP_DAY` request and updates the ledger method to `Consumed`.
- **REVOKE:** If the schedule changes retrospectively (e.g. the employee is now rostered OFF on that holiday), the engine detects the invalid state and **revokes** the credit to prevent overpayment.

---

## 🔒 Scope & Boundaries

It is critical to understand what this system does and *does not* do.

| ✅ In Scope | ❌ Out of Scope |
|---|---|
| **Daily Status** (Work, Off, Leave, Holiday) | **Payroll Calculations** (Rates, Payslips, Tax) |
| **Entitlement Actions** (Grant, Revoke) | **Overtime Rules** (1.5x, 2.0x multipliers) |
| **Shift Times** (Start, End) | **Labour Compliance** (Break times, 11hr rest rules) |
| **Scheduling Weights** (1.0 = Full Day, 0.5 = Half) | **Financial Values** ($) |

> **Important:** The `Final_Val` output (1.0, 0.5, 0.0) is a **scheduling weight** used for headcount and FTE reporting. It is **not** a pay multiplier.

> **Current Constraint:** The engine currently supports **fixed weekly patterns** (e.g. Mon-Fri). Support for **rotating rosters** (e.g. 4-on/4-off, Panama schedules) is a planned future extension.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CENTRAL DATABASE                         │
│  ┌──────────────┐ ┌───────────────┐ ┌────────────────────┐ │
│  │ Schedule_Rules│ │Decision_Matrix│ │Entitlement_Ledger  │ │
│  │ (per-employee │ │ (business     │ │(grant / revoke     │ │
│  │  overrides)   │ │  logic table) │ │ tracking)          │ │
│  └──────┬───────┘ └───────┬───────┘ └────────┬───────────┘ │
│         │                 │                   │             │
│  ┌──────┴─────┐  ┌───────┴──────┐  ┌─────────┴──────────┐ │
│  │ Holidays   │  │ Leave_Data   │  │ Shift_Status_Map   │ │
│  │ Scheduler  │  │ System_Logs  │  │ Admin_Config       │ │
│  │ Config     │  │              │  │                    │ │
│  └────────────┘  └──────────────┘  └────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  DECISION       │
                    │  ENGINE         │
                    │                 │
                    │ • Rule Parser   │
                    │ • Priority      │
                    │   Resolver      │
                    │ • Matrix Lookup │
                    │ • Audit Trace   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     ┌──────────────┐┌──────────────┐┌──────────────┐
     │ Workspace A  ││ Workspace B  ││ Workspace N  │
     │  Roster →    ││  Roster →    ││  Roster →    │
     │  Daily Status││  Daily Status││  Daily Status│
     └──────────────┘└──────────────┘└──────────────┘
```

---

## Module Structure

```
src/
├── Code.js                    # Entry point — orchestrates the full pipeline
├── Config.js                  # Centralised, deep-frozen configuration object
├── Engine/
│   ├── Resolver.js            # Core decision logic — dual-pass resolution + matrix lookup
│   ├── Rules.js               # Rule parser with strict priority hierarchy
│   ├── WorkspaceProcessor.js  # Multi-workspace orchestration and context loading
│   └── Ledger.js              # Entitlement grant / revoke with idempotent writes
└── Utils/
    ├── Helpers.js             # Date handling, header mapping, output writer
    ├── Logger.js              # Structured, buffered logging to System_Logs sheet
    ├── Validation.js          # Pre-flight schema validation
    └── SchemaValidator.js     # Header-drift detection across all sheets
tests/
└── TestHarness.js             # Server-side unit tests with mock spreadsheet layer
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **Decision matrix over hard-coded logic** | Business rules change frequently. A lookup table allows non-engineers to modify scheduling logic without touching code. |
| **Dual-pass rule resolution** | Day-pattern rules (state-changing) must resolve before shift-override rules (attribute-changing). Separating the passes prevents rule conflicts and guarantees deterministic output. |
| **Priority + deterministic tiebreaker** | When rules compete, highest priority wins. On tie, highest Rule ID wins. There is zero ambiguity in the outcome. |
| **Idempotent writes** | Every write checks existing state before mutating. The engine is safe to re-run at any time — critical for a system managing real employee schedules. |
| **Per-decision audit trace** | Every output cell includes a trace string showing exactly which rules were evaluated, in what order, and why the final result was chosen. |
| **Dry-run mode** | `CONFIG.isDryRun = true` executes the full pipeline without writing to any sheet — essential for validating changes against production data. |
| **Immutable configuration** | The global `CONFIG` object is deep-frozen at startup, eliminating an entire class of runtime mutation bugs. |

---

## Engineering Challenges

### 1. Combinatorial Rule Resolution

Each employee-day cell requires evaluating the intersection of: base schedule, active rules, holidays, leave, and entitlements. Rather than nesting conditionals, the engine pre-indexes the decision matrix into a `Map<string, Array>` for **O(1) lookups** on composite keys.

### 2. Multi-Workspace Consistency

All workspaces share a single central rule set and decision matrix. Context is loaded **once** and applied uniformly, ensuring that two workspaces with the same employee produce identical results. Ledger updates are committed back to the central database after each workspace completes.

### 3. Apps Script Runtime Constraints

Google Apps Script imposes a 6-minute execution limit, ~30 MB heap, and strict API quotas. The engine works within these constraints using:

- **Batch reads** — `getDataRange().getValues()` instead of cell-by-cell access
- **Batch writes** — `setValues()` instead of `appendRow()` loops
- **Column-scoped writes** — ledger revocations target individual columns to minimise blast radius
- **Execution-time guard** — monitors elapsed time and gracefully halts *before* the platform limit, ensuring logs are flushed and state remains consistent

### 4. Entitlement Lifecycle Management

Compensatory days are **granted** when an employee works on a holiday or off-day, and **revoked** when the underlying schedule changes. Both operations are idempotent: duplicate-check guards and activation-status tracking prevent double-grants or orphaned records.

### 5. Production Safety

- **Schema drift detection** — a pre-flight check validates every sheet's headers against `CONFIG`. If a column has been renamed, moved, or deleted, the engine fails fast with actionable diagnostics.
- **Buffered logging** — log entries are accumulated in memory and flushed in a single API call, reducing write overhead by ~40%.
- **Structured audit trail** — every run is tagged with a unique Run ID, and all log entries include level, timestamp, and context fields for post-mortem analysis.

---

## Execution Flow

```
1. STARTUP
   ├── Validate CONFIG (database ID, required fields)
   ├── Generate unique Run ID (UUID)
   └── Log: "Engine started"

2. LOAD CONTEXT (once, from central database)
   ├── Parse Shift → Status mapping
   ├── Index Decision Matrix into Map<key, rows>
   ├── Load Entitlement Ledger (active records only)
   ├── Load Leave Data
   ├── Parse and sort Schedule Rules (priority hierarchy)
   └── Parse Holiday calendar

3. FOR EACH ACTIVE WORKSPACE
   ├── Validate workspace schema (header-drift check)
   ├── Read roster sheet(s)
   ├── FOR EACH EMPLOYEE × DATE
   │   ├── Determine base schedule (shift + off-days)
   │   ├── Pass 1: Apply DAY_PATTERN rules (highest priority wins)
   │   ├── Pass 2: Apply SHIFT_OVERRIDE rules (if day is still a work day)
   │   ├── Lookup Decision Matrix → final status, shift, value
   │   ├── Run audit verification
   │   └── Collect entitlement actions (GRANT / REVOKE)
   ├── Write Daily_Workforce_Status output
   ├── Grant new entitlements (with duplicate check)
   └── Revoke stale entitlements (column-scoped writes)

4. COMPLETE
   └── Log: "Run completed in {duration}s"
```

---

## Deployment & Usage

### Option A — Manual Setup (No Dev Tools Required)

Best for users who want to deploy directly into Google Sheets without any local tooling.

1. **Create or open** the Google Sheet that will serve as your central database.
2. Navigate to **Extensions → Apps Script**.
3. In the script editor, create files matching the project structure:

   | Script File | Source |
   |---|---|
   | `Code.gs` | `src/Code.js` |
   | `Config.gs` | `src/Config.js` |
   | `Resolver.gs` | `src/Engine/Resolver.js` |
   | `Rules.gs` | `src/Engine/Rules.js` |
   | `WorkspaceProcessor.gs` | `src/Engine/WorkspaceProcessor.js` |
   | `Ledger.gs` | `src/Engine/Ledger.js` |
   | `Helpers.gs` | `src/Utils/Helpers.js` |
   | `Logger.gs` | `src/Utils/Logger.js` |
   | `Validation.gs` | `src/Utils/Validation.js` |
   | `SchemaValidator.gs` | `src/Utils/SchemaValidator.js` |

4. Copy the contents of each source file into the corresponding `.gs` file.
5. Update `Config.gs`:
   - Set `ids.database` to your central database's Google Sheets file ID.
   - Verify that tab names match your spreadsheet (refer to `docs/sample_data/` for schemas).
6. Set `isDryRun: false` when you are ready for production writes.

> [!TIP]
> Apps Script does not support folder nesting. All `.gs` files are flat in the editor — the naming convention above is purely for clarity.

### Option B — Developer Workflow (clasp)

For developers who prefer local editing, version control, and CI integration.

**Prerequisites:**
- [Node.js](https://nodejs.org/) (v16+)
- [clasp](https://github.com/google/clasp): `npm install -g @google/clasp`
- A Google account with Apps Script API enabled

**Steps:**

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/workforce-decision-engine.git
cd workforce-decision-engine

# Authenticate with Google
clasp login

# Create an Apps Script project bound to your Sheet
clasp create --type standalone --title "Workforce Decision Engine"

# Deploy source to Apps Script
clasp push

# Open the project in the browser
clasp open
```

After pushing, update `Config.gs` with your Sheet IDs as described in Option A.

### Configuration

| Parameter | Location | Description |
|---|---|---|
| `ids.database` | `Config.js` | File ID of the central database Google Sheet |
| `isDryRun` | `Config.js` | `true` = read-only simulation; `false` = production writes |
| `roster.tabs` | `Config.js` | Array of roster tab names to process |
| `tabs.*` | `Config.js` | Tab names and header mappings for all data sheets |

Refer to [`docs/sample_data/`](docs/sample_data/) for complete schema definitions and example data for every sheet.

### Running the Engine

| Method | How |
|---|---|
| **Manual** | Open your Sheet → Extensions → Apps Script → select `runWorkforceEngine` → **Run** |
| **Scheduled** | In the Apps Script editor, go to **Triggers** → add a time-driven trigger for `runWorkforceEngine` (e.g., nightly at 2 AM) |
| **Dry Run** | Set `isDryRun: true` in `Config.js`, then run. The full pipeline executes but no sheets are modified. |

---

## Testing

The project includes a server-side **unit test harness** that mocks the Google Sheets environment, enabling business-logic validation without touching live data.

**To run tests:**

1. Open the Apps Script editor.
2. Select `runAllTests` from the function dropdown.
3. Click **Run**.
4. Check the **Execution Log** for results.

**Test coverage includes:**

| Scenario | What It Validates |
|---|---|
| Normal work day | Base schedule resolution and status output |
| Weekend / off-day | RDO (regular day off) logic and off-day detection |
| Public holiday (worked) | Holiday flag + entitlement grant via ledger |
| Leave override | Leave priority over base schedule |
| Comp-day consumption | Ledger debit and activation-status update |

---

## Adaptation & Scalability

### Policy Customisation

The rules and decision matrix included in this repository (under `docs/sample_data/`) are **generalised examples** designed to demonstrate the engine's capabilities. They are not intended to be used as-is.

Every organisation has unique enterprise agreements, shift structures, and entitlement policies. To deploy this engine in production, you should adapt the `Decision_Matrix` and `Schedule_Rules` sheets to reflect your specific HR rules. **The engine is deliberately policy-agnostic** — it executes whatever logic your configuration sheets define.

### Beyond Google Sheets

The engine is designed for Google Sheets and Apps Script first. However, the **core resolver** (`Engine/Resolver.js`) is a pure function with no platform dependencies — it accepts data structures and returns results, with no calls to `SpreadsheetApp` or any Google API.

This means the resolver can be extracted and deployed as a:
- **Node.js Cloud Function** (Google Cloud Functions, AWS Lambda)
- **Backend microservice** for higher-volume scheduling (> 50k employee-days)
- **Component in a larger HR platform** with a proper database backend

The surrounding I/O layer (reading sheets, writing results, logging) would need to be replaced, but the decision logic ports cleanly.

### Need Help Adapting This?

This project was designed based on real-world Workforce Planning & Scheduling experience.  
If you are an organisation looking to implement or adapt this engine for your workflow, feel free to reach out to discuss your requirements.

📧 enayatulla135@gmail.com  
💼 https://www.linkedin.com/in/enayatullahhassani/

---

## License

MIT © Enayatulah Hassani
