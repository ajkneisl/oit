import type { ActivityKey, Block, MentorRosterEntry } from "../types";
import { fmtRange, fmtTime } from "./time";
import { ACTIVITY_KEYS, ACTIVITY_LABEL } from "./activity";

const CHECK_IN = "; check in with student lead";

/**
 * A trainee's note.
 */
export function formatTraineeNote(
    activity: ActivityKey,
    blocks: Block[],
): string {
    const label = ACTIVITY_LABEL[activity];

    if (activity === "canvas") {
        return `working on ${label}${CHECK_IN}`;
    }
    if (blocks.length === 0) {
        return `${label} (no mentor available)${CHECK_IN}`;
    }

    const parts = blocks.map((b, i) =>
        i < blocks.length - 1
            ? `with ${b.mentor} until ${fmtTime(b.end)}`
            : `with ${b.mentor}`,
    );
    return `${label} ${parts.join(", then ")}${CHECK_IN}`;
}

/**
 * A mentor's roster note, grouped by activity.
 */
export function formatMentorNote(entries: MentorRosterEntry[]): string {
    const sections: string[] = [];
    for (const key of ACTIVITY_KEYS) {
        if (key === "canvas") continue; // canvas trainees work independently

        const group = entries
            .filter((e) => e.activity === key)
            .sort((a, b) => a.start - b.start || a.end - b.end);
        if (group.length === 0) continue;

        const lines = group.map(
            (e) => `- ${e.trainee}: ${fmtRange(e.start, e.end)}`,
        );
        sections.push(`${ACTIVITY_LABEL[key]}:\n${lines.join("\n")}`);
    }
    return sections.join("\n\n");
}
