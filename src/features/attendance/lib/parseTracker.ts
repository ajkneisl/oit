import type { ParsedTracker, TrackerColumns, TrackerRow } from "../types";

/**
 * Parse the pasted attendance tracker sheet.
 *
 * Expected columns:
 *   Name | Internet ID | Email | Current Points | Last Changed | Last Notified | Last Ran
 */
export function parseTracker(text: string): ParsedTracker {
    const grid = text
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.split("\t"));

    // get header row
    let headerIdx = grid.findIndex(
        (r) =>
            r.some((c) => /^name$/i.test(c.trim())) &&
            r.some((c) => /current\s*points/i.test(c)),
    );
    if (headerIdx === -1) headerIdx = 0;

    const header = grid[headerIdx].map((c) => c.trim());
    const find = (re: RegExp) => header.findIndex((h) => re.test(h));

    const cols: TrackerColumns = {
        name: find(/^name$/i),
        internetId: find(/internet\s*id/i),
        email: find(/e-?mail/i),
        points: find(/current\s*points|^points$/i),
        lastChanged: find(/last\s*changed/i),
        lastNotified: find(/last\s*notified/i),
        lastRan: find(/last\s*ran/i),
    };

    if (cols.name === -1 || cols.points === -1) {
        throw new Error(
            'Could not find "Name" and "Current Points" columns. Paste the Attendance Tracker including its header row.',
        );
    }

    const rows: TrackerRow[] = [];

    for (let i = headerIdx + 1; i < grid.length; i++) {
        const r = grid[i];
        const name = (r[cols.name] ?? "").trim();

        if (!name) continue; // skip blank / trailing lines

        const cell = (idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : "");
        const pts = parseFloat(cell(cols.points));

        rows.push({
            rowIndex: rows.length,
            name,
            internetId: cell(cols.internetId),
            email: cell(cols.email),
            currentPoints: isNaN(pts) ? 0 : pts,
            lastChanged: cell(cols.lastChanged),
            lastNotified: cell(cols.lastNotified),
            lastRan: cell(cols.lastRan),
            raw: r.slice(),
        });
    }

    if (rows.length === 0) {
        throw new Error(
            "No data rows found under the header. Did the paste include the employee rows?",
        );
    }

    return { header, rows, cols };
}
