import * as XLSX from "xlsx";
import type { TraineeStatus } from "../types";
import { toActivityKey } from "./activity";

const SHEET_CANDIDATES = ["Service Desk Training Status", "Training Status"];

function colIndex(header: string[], ...aliases: string[]): number {
    const norm = header.map((h) =>
        String(h ?? "")
            .trim()
            .toLowerCase(),
    );

    for (const a of aliases) {
        const i = norm.indexOf(a.toLowerCase());
        if (i !== -1) return i;
    }

    // loose contains match as a fallback
    for (const a of aliases) {
        const i = norm.findIndex((h) => h.includes(a.toLowerCase()));
        if (i !== -1) return i;
    }
    return -1;
}

/**
 * Parse the OJT into what activity each person is supposed to be doing.
 */
export function parseOjt(buffer: ArrayBuffer): Map<string, TraineeStatus> {
    const wb = XLSX.read(buffer, { type: "array" });

    const sheetName =
        SHEET_CANDIDATES.find((n) => wb.SheetNames.includes(n)) ??
        wb.SheetNames.find((n) => /training status/i.test(n)) ??
        wb.SheetNames[0];

    if (!sheetName) throw new Error("No worksheet found in the OJT workbook.");

    const ws = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
    });

    if (grid.length < 2)
        throw new Error(`Sheet "${sheetName}" has no data rows.`);

    const header = (grid[0] as unknown[]).map((c) => String(c ?? ""));
    const cId = colIndex(header, "Internet ID", "Internet Id", "Employee ID");
    const cName = colIndex(header, "Name");
    const cSched = colIndex(
        header,
        "Scheduled for...",
        "Scheduled for",
        "Scheduled",
    );
    const cCheck = colIndex(
        header,
        "Manager Check-Off",
        "Check-Off",
        "Manager Check Off",
    );

    if (cId === -1 || cSched === -1) {
        throw new Error(
            `Could not locate "Internet ID" / "Scheduled for..." columns in "${sheetName}". ` +
                `Found header: ${header.join(", ")}`,
        );
    }

    const map = new Map<string, TraineeStatus>();
    for (let r = 1; r < grid.length; r++) {
        const cells = grid[r] as unknown[];
        const id = String(cells[cId] ?? "")
            .trim()
            .toLowerCase();

        if (!id) continue;
        const rawScheduledFor = String(cells[cSched] ?? "").trim();

        map.set(id, {
            id,
            name: cName >= 0 ? String(cells[cName] ?? "").trim() : id,
            activity: toActivityKey(rawScheduledFor),
            rawScheduledFor,
            checkOff: cCheck >= 0 ? String(cells[cCheck] ?? "").trim() : "",
        });
    }
    return map;
}
