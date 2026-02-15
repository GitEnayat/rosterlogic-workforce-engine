# Sample Data: Workspace — Consolidated Roster

Each workspace file contains this roster sheet. The header row is at row 4 and data starts at row 5.

| Employee ID | Default Shift | Primary Off Day | Secondary Off Day | 2025-03-01 | 2025-03-02 | 2025-03-03 | … | 2025-03-31 |
|---|---|---|---|---|---|---|---|---|
| emp-1042 | 09:00 - 18:00 | FRI | SAT | _(engine fills)_ | _(engine fills)_ | _(engine fills)_ | … | _(engine fills)_ |
| emp-2087 | 10:00 - 19:00 | FRI | SAT | | | | … | |
| emp-3001 | 09:00 - 18:00 | SUN | MON | | | | … | |

> **Note:** Date columns are dynamically detected. Any column with a valid date in the header row is processed.
