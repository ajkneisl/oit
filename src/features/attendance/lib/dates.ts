/**
 * The months! :)
 */
const MONTHS: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
};

/**
 * Parse the varying dates that may appear and return a UTC-midnight date, or null.
 */
export function parseFlexibleDate(value: unknown): Date | null {
    if (value == null || value === "") return null;

    if (value instanceof Date && !isNaN(value.getTime())) {
        return new Date(
            Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
        );
    }

    // excel serial date
    if (typeof value === "number") {
        const epoch = Date.UTC(1899, 11, 30);
        return new Date(epoch + Math.round(value) * 86_400_000);
    }

    const dateStr = String(value).trim();

    if (!dateStr) return null;

    // "May 28, 2026" / "May 28 2026" / "Sept. 1, 2026"
    let m = dateStr.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
    if (m) {
        const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
        if (mo == null) return null;
        return new Date(Date.UTC(+m[3], mo, +m[2]));
    }

    // "M/D/YY" or "MM/DD/YYYY"
    m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
        let y = +m[3];
        if (y < 100) y += 2000;
        return new Date(Date.UTC(y, +m[1] - 1, +m[2]));
    }

    // ISO "YYYY-MM-DD"
    m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));

    const d = new Date(dateStr);
    return isNaN(d.getTime())
        ? null
        : new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Format as "M/D/YY"
 */
export function formatMDY(d: Date): string {
    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}`;
}

/**
 * Get the amount of whole days between two dates.
 */
export function daysBetween(a: Date, b: Date): number {
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * UTC-midnight date for the given day.
 */
export function startOfDayUTC(now: Date = new Date()): Date {
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}
