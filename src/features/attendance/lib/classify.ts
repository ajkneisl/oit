import type { AbsenceKind } from "../types";

/**
 * Classify the W2W description as the type.
 *
 * The order of this describes which one happens first:
 *   - "continued"          skip
 *   - ns / no show / -3    no show, -3
 *   - missed / sick / -1   missed, -3
 *   - late / -0.5          missed, -3
 *   - anything else        require manual review
 */
export function classifyNote(note: string): AbsenceKind {
    const n = note.toLowerCase().trim();
    if (!n) return "unknown";

    if (/continued/.test(n)) return "skip";

    if (
        /no[\s-]*show/.test(n) ||
        /\bns\b/.test(n) ||
        /(^|[^\d.])-3\b/.test(n)
    ) {
        return "noshow";
    }

    if (
        /miss(ed)?\d*/.test(n) ||
        /\bsick\b/.test(n) ||
        /(^|[^\d.])-1\b/.test(n)
    ) {
        return "missed";
    }

    if (/\blate\b/.test(n) || /-0?\.5\b/.test(n)) return "late";

    return "unknown";
}
