# Sample Data: Entitlement_Ledger (Central DB)

Tracks compensatory day accrual and consumption.

| Employee_ID | Entitlement_Date | Date_Used | Week | Mapping | Final_Entitlement_Status | Activation_Status | Entitlement_Type | Snapshot_Status | System_Note |
|---|---|---|---|---|---|---|---|---|---|
| emp-1042 | 2025-01-26 | | W04 | WK-PH | COMP_DAY | Active | COMP_DAY | GENERATED | Work on public holiday — comp day granted |
| emp-1042 | 2025-03-31 | 2025-04-05 | W13 | WK-PH | OFF | Inactive | COMP_DAY | CONSUMED | Comp Day Consumed |
| emp-2087 | 2025-05-01 | | W18 | WK-PH | COMP_DAY | Active | COMP_DAY | GENERATED | Work on public holiday — comp day granted |
| emp-3001 | 2025-08-15 | | W33 | WK-PH | COMP_DAY | Inactive | COMP_DAY | REVOKED | Revoked: Work/Rule Change |

> **Key states:**
> - `Active` + `COMP_DAY` = Available for use
> - `Inactive` + `CONSUMED` = Used by the employee
> - `Inactive` + `REVOKED` = Schedule changed, entitlement no longer valid
