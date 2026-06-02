export type ActivityKey = 'emails' | 'phones' | 'canvas' | 'shadow';

/** One row of the "Schedules Summary" sheet = one person's shift on one date. */
export interface ScheduleRow {
  /** 0-based index among data rows (header excluded). */
  rowIndex: number;
  /** 1-based Excel row number (header is row 1). */
  excelRow: number;
  position: string;
  firstName: string;
  lastName: string;
  /** Lower-cased employee / internet id, used to join to the OJT sheet. */
  id: string;
  email: string;
  /** YYYY-MM-DD */
  date: string;
  /** Minutes from midnight. */
  start: number;
  end: number;
  isMentor: boolean;
  /** Original Notes cell value. */
  notes: string;
}

/** Per-trainee status pulled from ojt.xlsx "Service Desk Training Status". */
export interface TraineeStatus {
  id: string;
  name: string;
  activity: ActivityKey;
  rawScheduledFor: string;
  checkOff: string;
}

export interface Block {
  mentor: string;
  start: number;
  end: number;
}

export interface TraineeAssignment {
  row: ScheduleRow;
  activity: ActivityKey;
  /** Mentor blocks covering the shift (empty for Canvas / when no mentor available). */
  blocks: Block[];
  note: string;
}

export interface MentorRosterEntry {
  trainee: string;
  activity: ActivityKey;
  start: number;
  end: number;
}

export interface MentorAssignment {
  row: ScheduleRow;
  entries: MentorRosterEntry[];
  note: string;
}

export interface DayResult {
  date: string;
  trainees: TraineeAssignment[];
  mentors: MentorAssignment[];
  warnings: string[];
}

export interface ParsedSchedule {
  sheetName: string;
  rows: ScheduleRow[];
  dates: string[];
  /** Raw bytes of the uploaded workbook, kept for export. */
  buffer: ArrayBuffer;
  fileName: string;
}
