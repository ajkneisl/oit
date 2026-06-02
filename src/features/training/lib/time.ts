/** Time helpers. All times are minutes from midnight. */

/**
 * Parse a time string.
 */
export function parseTime(value: unknown): number | null {
    if (value == null || value === "") return null;

    // excel sometimes gives a numeric fraction of a day (0..1) for times
    if (typeof value === "number") {
        const frac = value % 1;
        return Math.round(frac * 24 * 60);
    }

    const s = String(value).trim();
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const ap = m[3] ? m[3].toLowerCase().replace(/\./g, "") : "";
    if (ap === "pm" && h !== 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    return h * 60 + min;
}

/**
 * Format minutes.
 */
export function fmtTime(mins: number, meridiem = true): string {
    let h = Math.floor(mins / 60);
    const m = mins % 60;
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12;
    if (h === 0) h = 12;
    const base = m ? `${h}:${String(m).padStart(2, "0")}` : `${h}`;
    return meridiem ? `${base} ${ap}` : base;
}

/**
 * Format a time range.
 */
export function fmtRange(start: number, end: number): string {
    return `${fmtTime(start, false)} - ${fmtTime(end, true)}`;
}

/** Two intervals overlap if they share more than a single instant. */
export function overlaps(
    aStart: number,
    aEnd: number,
    bStart: number,
    bEnd: number,
): boolean {
    return aStart < bEnd && bStart < aEnd;
}

/**
 * Format a date label.
 */
export function fmtDate(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
}
