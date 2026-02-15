# Sample Data: Decision_Matrix (Central DB)

The business logic lookup table. Drives all final scheduling decisions.

| Base_Schedule | Rule_Impact | Holiday_Flag | Request_Type | Final_Status | Entitlement_Action | Decision_Reason |
|---|---|---|---|---|---|---|
| WORK | NONE | FALSE | NONE | WORK | NONE | Regular work day |
| WORK | NONE | TRUE | NONE | WORK | GRANT | Work on public holiday — comp day granted |
| WORK | NONE | FALSE | LEAVE | LEAVE | NONE | Approved leave |
| WORK | OFF | FALSE | NONE | OFF | NONE | Rule changed work to off |
| OFF | NONE | FALSE | NONE | OFF | NONE | Scheduled off day |
| OFF | WORK | FALSE | NONE | WORK | NONE | Rule changed off to work |
| OFF | WORK | TRUE | NONE | WORK | GRANT | Rule changed off to work on holiday |
| WORK | NONE | FALSE | COMP_DAY | COMP_DAY | REVOKE | Comp day consumed |
| OFF | NONE | TRUE | NONE | OFF | NONE | Holiday on off day — no change |
| ANY | ANY | ANY | LEAVE | LEAVE | NONE | Leave takes precedence over all |

> **Design note:** `ANY` acts as a wildcard. Rows are evaluated in order — more specific rows should appear before wildcard rows.
