# Sample Data: Schedule_Rules (Central DB)

Per-employee overrides. The engine filters by date range, frequency, and approval status.

| Rule_ID | Employee_ID | Rule_Type | Start_Date | End_Date | Shift_Value | Primary_Off_Day | Secondary_Off_Day | Frequency | Approval_Status | Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| R-001 | emp-1042 | DAY_PATTERN | 2025-01-01 | 2025-06-30 | | WED | THU | ALL | Approved | 5 |
| R-002 | emp-1042 | SHIFT_OVERRIDE | 2025-03-01 | 2025-03-31 | 10:00 - 19:00 | | | ALL | Approved | 3 |
| R-003 | emp-2087 | DAY_PATTERN | 2025-02-01 | 2025-12-31 | | FRI | SAT | ALL | Approved | 5 |
| R-004 | emp-2087 | SHIFT_OVERRIDE | 2025-04-15 | 2025-04-15 | 07:00 - 16:00 | | | TUE | Approved | 8 |
| R-005 | emp-3001 | SHIFT_OVERRIDE | 2025-01-01 | 2025-12-31 | 08:00 - 17:00 | | | MON,WED,FRI | Approved | 2 |
| R-006 | emp-1042 | DAY_PATTERN | 2025-04-01 | 2025-04-30 | | SUN | MON | ALL | Pending | 7 |

> **Key observations:**
> - R-006 has `Pending` status → engine ignores it
> - R-001 and R-002 both target `emp-1042` → DAY_PATTERN resolves first, then SHIFT_OVERRIDE applies if still a work day
> - R-004 has Frequency `TUE` → only activates on Tuesdays within the date range
