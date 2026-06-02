import * as XLSX from "xlsx";
import type { AbsenceEvent } from "../types";
import { classifyNote } from "./classify";
import { parseFlexibleDate } from "./dates";

/**
 * Read a W2W absence Excel sheet.
 *
 * Expected columns: Employee | Shift Date | ... | Reporter Note
 */
export function parseAbsences(buffer: ArrayBuffer): AbsenceEvent[] {
    const wb = XLSX.read(buffer, { type: "array" });

    // try to find the right sheet
    const sheetName =
        wb.SheetNames.find((n) => /absence/i.test(n)) ?? wb.SheetNames[0];

    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error("The uploaded workbook has no readable sheet.");

    // convert sheet to json
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: false,
        defval: "",
    });
    if (grid.length < 1) return [];

    const header = (grid[0] as unknown[]).map((c) => String(c).trim());
    const find = (re: RegExp) => header.findIndex((h) => re.test(h));

    // find the needed columns
    const empCol = find(/employee|^name$/i);
    const dateCol = find(/shift\s*date|^date$/i);
    const noteCol = find(/report.*note|^note$/i);

    if (empCol === -1 || noteCol === -1) {
        throw new Error(
            'Absences sheet needs an "Employee" column and a "Reporter Note" column.',
        );
    }

    const out: AbsenceEvent[] = [];

    for (let i = 1; i < grid.length; i++) {
        const absenceRow = grid[i] as unknown[];
        const employee = String(absenceRow[empCol] ?? "").trim();
        if (!employee) continue;

        const note = String(absenceRow[noteCol] ?? "").trim();
        const rawDate =
            dateCol >= 0 ? String(absenceRow[dateCol] ?? "").trim() : "";

        // create an event for each absence
        out.push({
            employee,
            rawDate,
            date: parseFlexibleDate(rawDate),
            note,
            kind: classifyNote(note),
        });
    }

    return out;
}
