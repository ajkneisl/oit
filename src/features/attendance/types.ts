export type AbsenceKind = 'noshow' | 'missed' | 'late' | 'skip' | 'unknown';

/** Point cost of each deducting kind. */
export const KIND_POINTS: Record<'noshow' | 'missed' | 'late', number> = {
  noshow: 3,
  missed: 1,
  late: 0.5,
};

/** One employee row from the pasted "Attendance Tracker" sheet. */
export interface TrackerRow {
  /** 0-based index among data rows. */
  rowIndex: number;
  name: string;
  internetId: string;
  email: string;
  currentPoints: number;
  /** Raw cell values, exactly as pasted (used to re-emit untouched columns). */
  raw: string[];
  lastChanged: string;
  lastNotified: string;
  lastRan: string;
}

export interface TrackerColumns {
  name: number;
  internetId: number;
  email: number;
  points: number;
  lastChanged: number;
  lastNotified: number;
  lastRan: number;
}

export interface ParsedTracker {
  header: string[];
  rows: TrackerRow[];
  cols: TrackerColumns;
}

/** One absence event from the uploaded W2W "Absences" export. */
export interface AbsenceEvent {
  employee: string;
  rawDate: string;
  date: Date | null;
  note: string;
  kind: AbsenceKind;
}

/** The computed update for a single tracker row. */
export interface PointChange {
  rowIndex: number;
  name: string;
  oldPoints: number;
  newPoints: number;
  deduction: number;
  recovery: number;
  /** Did anything that resets "Last Changed" happen? */
  changed: boolean;
  /** Human-readable explanation lines. */
  details: string[];
  oldLastChanged: string;
  newLastChanged: string;
}

export interface UpdateResult {
  /** One entry per tracker row, in original order. */
  changes: PointChange[];
  /** Full output sheet (header + every row) ready to copy back as TSV. */
  outputRows: string[][];
  /** Absences whose employee was not found in the tracker. */
  unmatched: AbsenceEvent[];
  /** Absences skipped because the note was marked "continued". */
  continued: AbsenceEvent[];
  /** Absences whose note could not be classified. */
  unknown: AbsenceEvent[];
}
