import type {
    AbsenceEvent,
    ParsedTracker,
    PointChange,
    TrackerRow,
    UpdateResult,
} from "../types";
import { daysBetween, formatMDY, parseFlexibleDate } from "./dates";

const MAX_POINTS = 9;
const RECOVERY_DAYS = 30;

/**
 * Normalize a name for matching.
 * - Drop parentheticals/punctuation
 * - Set to lowercase
 * - Collapse spaces
 */
export function normName(s: string): string {
    return s
        .toLowerCase()
        .replace(/\([^)]*\)/g, " ")
        .replace(/[^a-z\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Round to the nearest 0.5 and render without trailing ".0".
 */
export function formatPoints(p: number): string {
    const r = Math.round(p * 2) / 2;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function shortDate(e: AbsenceEvent): string {
    return e.date ? formatMDY(e.date) : e.rawDate || "(no date)";
}

/**
 * Sum the amount of point deduction for a person's absence events and explain.
 *
 * Every missed/sick event counts as its own −1 — adjacent dates are NOT
 * merged. The only thing that collapses a multi-day spell is an explicit
 * "Continued" note, which is classified as `skip` before we get here.
 */
function computeDeduction(events: AbsenceEvent[]): {
    deduction: number;
    lines: string[];
} {
    const lines: string[] = [];
    let deduction = 0;

    for (const e of events.filter((x) => x.kind === "noshow")) {
        deduction += 3;
        lines.push(`no show ${shortDate(e)} (−3)`);
    }

    for (const e of events.filter((x) => x.kind === "missed")) {
        deduction += 1;
        lines.push(`missed/sick ${shortDate(e)} (−1)`);
    }

    for (const event of events.filter((x) => x.kind === "late")) {
        deduction += 0.5;
        lines.push(`late ${shortDate(event)} (−0.5)`);
    }

    return { deduction, lines };
}

/**
 * Apply absences to the tracker and create the updated sheet.
 *
 * This:
 * - subtracts the deductions (-3, -1, -0.5) depending on the case,
 * - adds a point back for 30 days of good attendance,
 * - update the last ran date,
 * - update last changed date if need be.
 */
export function computeUpdates(
    tracker: ParsedTracker,
    absences: AbsenceEvent[],
    today: Date,
): UpdateResult {
    const { cols } = tracker;

    // each person's attendance tracking row
    const byName = new Map<string, TrackerRow[]>();
    for (const row of tracker.rows) {
        const key = normName(row.name);
        const list = byName.get(key);

        if (list) list.push(row);
        else byName.set(key, [row]);
    }

    const matched = new Map<TrackerRow, AbsenceEvent[]>();
    const unmatched: AbsenceEvent[] = [];
    const continued: AbsenceEvent[] = [];
    const unknown: AbsenceEvent[] = [];
    // Any employee who appears in the report this run — for any kind of
    // absence (deductible, unrecognized, or continued) — is not eligible for
    // the 30-day +1 recovery this run.
    const hasAbsence = new Set<TrackerRow>();

    for (const e of absences) {
        const rows = byName.get(normName(e.employee));
        const row = rows && rows.length > 0 ? rows[0] : null;

        if (e.kind === "skip") {
            continued.push(e);
            if (row) hasAbsence.add(row);
            continue;
        }

        if (!row) {
            unmatched.push(e);
            continue;
        }

        hasAbsence.add(row);

        if (e.kind === "unknown") {
            unknown.push(e); // matched to a person but note unrecognized
            continue;
        }

        const list = matched.get(row);

        if (list) list.push(e);
        else matched.set(row, [e]);
    }

    const changes: PointChange[] = [];
    const outputRows: string[][] = [tracker.header.slice()];

    for (const row of tracker.rows) {
        const events = matched.get(row) ?? [];
        const { deduction, lines } = computeDeduction(events);
        const details = [...lines];

        let points = row.currentPoints;
        let changed = false;
        let recovery = 0;

        if (deduction > 0) {
            points -= deduction;
            changed = true;
        }

        const lc = parseFlexibleDate(row.lastChanged);
        if (lc && !hasAbsence.has(row)) {
            const age = daysBetween(lc, today);

            if (age >= RECOVERY_DAYS && points < MAX_POINTS) {
                points = Math.min(MAX_POINTS, points + 1);
                recovery = 1;
                changed = true;
                details.push("+1 (30+ days)");
            }
        } else if (!lc && row.lastChanged) {
            details.push(
                `invalid Last Changed date "${row.lastChanged}", recovery skipped`,
            );
        }

        changes.push({
            rowIndex: row.rowIndex,
            name: row.name,
            oldPoints: row.currentPoints,
            newPoints: points,
            deduction,
            recovery,
            changed,
            details,
            oldLastChanged: row.lastChanged,
            newLastChanged: changed ? formatMDY(today) : row.lastChanged,
        });

        const out = row.raw.slice();
        const setCell = (idx: number, value: string) => {
            if (idx < 0) return;
            while (out.length <= idx) out.push("");
            out[idx] = value;
        };

        setCell(cols.points, formatPoints(points));
        setCell(cols.lastRan, formatMDY(today));

        if (changed) setCell(cols.lastChanged, formatMDY(today));

        outputRows.push(out);
    }

    return { changes, outputRows, unmatched, continued, unknown };
}
