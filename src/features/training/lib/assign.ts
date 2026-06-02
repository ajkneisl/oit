import type {
    ActivityKey,
    Block,
    DayResult,
    MentorAssignment,
    MentorRosterEntry,
    ScheduleRow,
    TraineeAssignment,
} from "../types";
import { formatMentorNote, formatTraineeNote } from "./notes";

export interface AssignOptions {
    /** Resolved activity per trainee id (after applying overrides). */
    activityById: Map<string, ActivityKey>;
    /** Default activity for trainees with no OJT match. */
    defaultActivity: ActivityKey;
}

interface MentorAvail {
    name: string;
    intervals: Array<[number, number]>;
}

/** Does the mentor have an availability interval fully covering [a, b]? */
function covers(av: MentorAvail, a: number, b: number): boolean {
    return av.intervals.some(([s, e]) => s <= a && e >= b);
}

/**
 * Assign mentors to trainees for a single day, then format both the trainee
 * notes and the mentor roster notes.
 *
 * Strategy: slice the day at every shift boundary. Walk each trainee's shift
 * segment by segment; in each segment pick an available mentor, preferring to
 * keep the same mentor as the previous segment (continuity) and otherwise the
 * one with the fewest trainees in that same segment (load balancing). No hard
 * capacity cap. Adjacent same-mentor segments are merged into blocks.
 */
export function assignDay(
    date: string,
    rowsForDate: ScheduleRow[],
    opts: AssignOptions,
): DayResult {
    const warnings: string[] = [];

    const mentorRows = rowsForDate.filter((r) => r.isMentor);
    const traineeRows = rowsForDate.filter((r) => !r.isMentor);

    // mentor availability keyed by first name (as used in notes)
    const availByName = new Map<string, MentorAvail>();
    for (const m of mentorRows) {
        const av = availByName.get(m.firstName) ?? {
            name: m.firstName,
            intervals: [],
        };
        av.intervals.push([m.start, m.end]);
        availByName.set(m.firstName, av);
    }
    const mentors = [...availByName.values()];

    // day breakpoints: every distinct shift boundary
    const bpSet = new Set<number>();
    for (const r of rowsForDate) {
        bpSet.add(r.start);
        bpSet.add(r.end);
    }
    const breakpoints = [...bpSet].sort((a, b) => a - b);

    // segLoad[segKey][mentorName] = trainees already on that mentor in that segment
    const segLoad = new Map<string, Map<string, number>>();
    const dayLoad = new Map<string, number>();
    const segKey = (a: number, b: number) => `${a}-${b}`;

    const bump = (map: Map<string, number>, k: string) =>
        map.set(k, (map.get(k) ?? 0) + 1);

    // place longer shifts first for steadier balancing
    const orderedTrainees = [...traineeRows].sort(
        (x, y) => x.start - y.start || y.end - y.start - (x.end - x.start),
    );

    // roster entries per mentor name for this day
    const rosterByMentor = new Map<string, MentorRosterEntry[]>();
    const pushRoster = (mentor: string, entry: MentorRosterEntry) => {
        const list = rosterByMentor.get(mentor) ?? [];
        list.push(entry);
        rosterByMentor.set(mentor, list);
    };

    const traineeAssignments: TraineeAssignment[] = [];

    for (const t of orderedTrainees) {
        const activity = opts.activityById.get(t.id) ?? opts.defaultActivity;

        if (activity === "canvas") {
            traineeAssignments.push({
                row: t,
                activity,
                blocks: [],
                note: formatTraineeNote(activity, []),
            });
            continue;
        }

        // per-segment mentor choices across this trainee's shift
        const segChoices: Array<{
            a: number;
            b: number;
            mentor: string | null;
        }> = [];
        let prev: string | null = null;

        for (let i = 0; i < breakpoints.length - 1; i++) {
            const a = breakpoints[i];
            const b = breakpoints[i + 1];
            if (a < t.start || b > t.end) continue; // segment outside this shift

            const candidates = mentors.filter((m) => covers(m, a, b));
            if (candidates.length === 0) {
                segChoices.push({ a, b, mentor: null });
                prev = null;
                continue;
            }

            const key = segKey(a, b);
            const loads = segLoad.get(key) ?? new Map<string, number>();
            segLoad.set(key, loads);

            let chosen: string;
            if (prev && candidates.some((m) => m.name === prev)) {
                chosen = prev; // continuity
            } else {
                chosen = candidates
                    .map((m) => m.name)
                    .sort((m1, m2) => {
                        const l1 = loads.get(m1) ?? 0;
                        const l2 = loads.get(m2) ?? 0;
                        if (l1 !== l2) return l1 - l2; // fewest in this segment
                        const d1 = dayLoad.get(m1) ?? 0;
                        const d2 = dayLoad.get(m2) ?? 0;
                        if (d1 !== d2) return d1 - d2; // fewest across the day
                        return m1.localeCompare(m2);
                    })[0];
            }

            bump(loads, chosen);
            bump(dayLoad, chosen);
            segChoices.push({ a, b, mentor: chosen });
            prev = chosen;
        }

        // merge adjacent segments with the same mentor into blocks
        const blocks: Block[] = [];
        for (const seg of segChoices) {
            const last = blocks[blocks.length - 1];
            if (
                last &&
                last.mentor === (seg.mentor ?? "(no mentor)") &&
                last.end === seg.a
            ) {
                last.end = seg.b;
            } else {
                blocks.push({
                    mentor: seg.mentor ?? "(no mentor)",
                    start: seg.a,
                    end: seg.b,
                });
            }
        }

        if (blocks.some((b) => b.mentor === "(no mentor)")) {
            warnings.push(
                `${t.firstName} ${t.lastName}: part of the shift has no available mentor.`,
            );
        }

        const realBlocks = blocks.filter((b) => b.mentor !== "(no mentor)");
        for (const b of realBlocks) {
            pushRoster(b.mentor, {
                trainee: t.firstName.toLowerCase(),
                activity,
                start: b.start,
                end: b.end,
            });
        }

        traineeAssignments.push({
            row: t,
            activity,
            blocks: realBlocks,
            note: formatTraineeNote(activity, realBlocks),
        });
    }

    // build mentor notes — attach each roster entry to the mentor row whose
    // shift window contains it (handles mentors with more than one shift that day)
    const mentorAssignments: MentorAssignment[] = [];
    const mentorRowsByName = new Map<string, ScheduleRow[]>();
    for (const m of mentorRows) {
        const list = mentorRowsByName.get(m.firstName) ?? [];
        list.push(m);
        mentorRowsByName.set(m.firstName, list);
    }

    for (const [name, rows] of mentorRowsByName) {
        const entries = rosterByMentor.get(name) ?? [];
        const sorted = [...rows].sort((a, b) => a.start - b.start);
        const buckets = new Map<number, MentorRosterEntry[]>();
        sorted.forEach((_, i) => buckets.set(i, []));

        for (const e of entries) {
            let idx = sorted.findIndex(
                (r) => r.start <= e.start && r.end >= e.end,
            );
            if (idx === -1)
                idx = sorted.findIndex(
                    (r) => r.start <= e.start && r.end > e.start,
                );
            if (idx === -1) idx = 0;
            buckets.get(idx)!.push(e);
        }

        sorted.forEach((row, i) => {
            const bucket = buckets.get(i)!;
            mentorAssignments.push({
                row,
                entries: bucket,
                note: formatMentorNote(bucket),
            });
        });
    }

    return {
        date,
        trainees: traineeAssignments,
        mentors: mentorAssignments,
        warnings,
    };
}

export interface GenerateResult {
    days: DayResult[];
    /** rowIndex -> generated note, for every row that received one. */
    notesByRow: Map<number, string>;
}

export function generateAll(
    rows: ScheduleRow[],
    dates: string[],
    opts: AssignOptions,
): GenerateResult {
    const days: DayResult[] = [];
    const notesByRow = new Map<number, string>();
    for (const date of dates) {
        const dayRows = rows.filter((r) => r.date === date);
        const result = assignDay(date, dayRows, opts);
        days.push(result);
        for (const t of result.trainees) notesByRow.set(t.row.rowIndex, t.note);
        for (const m of result.mentors) notesByRow.set(m.row.rowIndex, m.note);
    }
    return { days, notesByRow };
}
