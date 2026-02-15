# Sample Data: Workspace — Daily_Workforce_Status (Engine Output)

This is the output sheet written by the engine. One row per employee-day.

| Key | Employee | Date | Base_Status | Base_Shift | Rule_Input | Leave_Input | PH_Input | Entitlement_Input | Final_Status | Final_Shift | Reason | Note | Final_Val |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| emp-1042\|2025-03-01 | emp-1042 | 2025-03-01 | WORK | 09:00 - 18:00 | 10:00 - 19:00 | NONE | FALSE | NONE | WORK | 10:00 - 19:00 | Shift override applied | [BASE:WORK:09:00 - 18:00] \| [SHIFT:R-002:10:00 - 19:00:P3] | 1.0 |
| emp-1042\|2025-03-05 | emp-1042 | 2025-03-05 | OFF | OFF | OFF | NONE | FALSE | NONE | OFF | OFF | Rule changed off day | [BASE:OFF:OFF] \| [DAY_PATTERN:R-001:OFF:P5] | 0.0 |
| emp-1042\|2025-03-10 | emp-1042 | 2025-03-10 | WORK | 09:00 - 18:00 | 10:00 - 19:00 | ANNUAL | FALSE | NONE | ANNUAL | OFF | Approved leave | [BASE:WORK:09:00 - 18:00] \| [SHIFT:R-002:10:00 - 19:00:P3] | 0.0 |
| emp-2087\|2025-05-01 | emp-2087 | 2025-05-01 | WORK | 10:00 - 19:00 | 10:00 - 19:00 | NONE | TRUE | NONE | WORK | 10:00 - 19:00 | Work on public holiday | [BASE:WORK:10:00 - 19:00] | 1.0 |
