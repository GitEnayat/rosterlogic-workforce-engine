/**
 * Global configuration for the Workforce Decision Engine
 */
const CONFIG = {

  isDryRun: true,

  ids: {
    database: 'CENTRAL_DATABASE_FILE_ID'
  },

  validWorkStatuses: new Set(['WORK', 'REGULAR', 'SHIFT_OVERRIDE']),

  roster: {
    tabs: ['Consolidated'],
    rows: { header: 4, data: 5 },
    cols: {
      employee_id: 'Employee ID',
      default_shift: 'Default Shift',
      primary_off_day: 'Primary Off Day',
      secondary_off_day: 'Secondary Off Day',
      schedule_grid_start: 'Schedule Start',
      schedule_grid_end: 'Schedule End'
    }
  },

  tabs: {
    config: {
      name: 'Scheduler_Config',
      h: { id: 'Workspace_File_ID', status: 'Status' }
    },
    rules: {
      name: 'Schedule_Rules',
      h: {
        id: 'Rule_ID',
        employee: 'Employee_ID',
        type: 'Rule_Type',
        start: 'Start_Date',
        end: 'End_Date',
        shift: 'Shift_Value',
        wo1: 'Primary_Off_Day',
        wo2: 'Secondary_Off_Day',
        freq: 'Frequency',
        status: 'Approval_Status',
        prio: 'Priority'
      }
    },
    decision: {
      name: 'Decision_Matrix',
      h: {
        base: 'Base_Schedule',
        rule: 'Rule_Impact',
        ph: 'Holiday_Flag',
        req: 'Request_Type',
        final: 'Final_Status',
        action: 'Entitlement_Action',
        reason: 'Decision_Reason'
      }
    },
    mapping: {
      name: 'Shift_Status_Mapping',
      h: { shift: 'Shift_Code', status: 'Work_Status' }
    },
    dailyStatus: {
      name: 'Daily_Workforce_Status'
    },
    holidays: {
      name: 'Holidays',
      h: { date: 'Date' }
    },
    leaves: {
      name: 'Leave_Data',
      h: {
        employee: 'Employee_ID',
        date: 'Leave_Date',
        cat: 'Leave_Type'
      }
    },
    ledger: {
      name: 'Entitlement_Ledger',
      h: {
        employee: 'Employee_ID',
        entitlementDate: 'Entitlement_Date',
        dateUsed: 'Date_Used',
        week: 'Week',
        mapping: 'Mapping',
        status: 'Final_Entitlement_Status',
        activation: 'Activation_Status',
        entitlement: 'Entitlement_Type',
        snap: 'Snapshot_Status',
        scriptNote: 'System_Note'
      }
    },
    logs: {
      name: 'System_Logs',
      h: {
        runId: 'Run_ID',
        timestamp: 'Timestamp',
        level: 'Level',
        message: 'Message',
        context: 'Context'
      }
    }
  }
};


function deepFreeze(obj) {
  Object.getOwnPropertyNames(obj).forEach(prop => {
    if (obj[prop] && typeof obj[prop] === "object") {
      deepFreeze(obj[prop]);
    }
  });
  return Object.freeze(obj);
}

deepFreeze(CONFIG);

