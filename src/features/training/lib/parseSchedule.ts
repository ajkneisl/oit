import * as XLSX from "xlsx";
import type { ParsedSchedule, ScheduleRow } from "../types";
import { parseTime } from "./time";

const SHEET_CANDIDATES = [
    "Schedules Summary",
    "Schedule Summary",
    "Schedules",
    "Schedule",
];

const MENTOR_POSITION = /mentor/i;

/** Find a header column by trying several name aliases (case-insensitive). */
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
    return -1;
}

/** Normalize a date cell to YYYY-MM-DD (ISO, m/d/yyyy, or excel serial). */
function normalizeDate(value: unknown): string {
    if (value == null || value === "") return "";
    if (typeof value === "number") {
        const d = XLSX.SSF.parse_date_code(value);
        if (d) return `${d.y}-${pad(d.m)}-${pad(d.d)}`;
    }
    const s = String(value).trim();
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`;
    const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (us) {
        const y = us[3].length === 2 ? `20${us[3]}` : us[3];
        return `${y}-${pad(+us[1])}-${pad(+us[2])}`;
    }
    return s;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseSchedule(
    buffer: ArrayBuffer,
    fileName: string,
): ParsedSchedule {
    const wb = XLSX.read(buffer, { type: "array" });
    const sheetName =
        SHEET_CANDIDATES.find((n) => wb.SheetNames.includes(n)) ??
        wb.SheetNames.find((n) => /schedule/i.test(n)) ??
        wb.SheetNames[wb.SheetNames.length - 1];
    if (!sheetName)
        throw new Error("No worksheet found in the schedule workbook.");

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
    const c = {
        position: colIndex(header, "Position"),
        first: colIndex(header, "First Name", "First"),
        last: colIndex(header, "Last Name", "Last"),
        id: colIndex(header, "Employee ID", "Internet ID", "Employee Id"),
        email: colIndex(header, "Email"),
        date: colIndex(header, "Shift Start Date", "Date"),
        start: colIndex(header, "Shift Start Time", "Start Time", "Start"),
        end: colIndex(header, "Shift End Time", "End Time", "End"),
        notes: colIndex(header, "Notes", "Note"),
    };
    if (c.first === -1 || c.date === -1 || c.start === -1 || c.end === -1) {
        throw new Error(
            `Could not locate required columns in "${sheetName}". Found header: ${header.join(", ")}`,
        );
    }

    const rows: ScheduleRow[] = [];
    const dateSet = new Set<string>();

    for (let r = 1; r < grid.length; r++) {
        const cells = grid[r] as unknown[];
        const get = (i: number) =>
            i >= 0 ? String(cells[i] ?? "").trim() : "";

        const first = get(c.first);
        const date = normalizeDate(cells[c.date]);
        const start = parseTime(cells[c.start]);
        const end = parseTime(cells[c.end]);
        // skip totals / blank / open-shift rows that lack a real person + time
        // (an "OpenShift" is an unfilled posting, not a real mentor/trainee)
        if (
            !first ||
            /^open\s*shift$/i.test(first) ||
            !date ||
            start == null ||
            end == null
        )
            continue;

        const position = get(c.position);
        rows.push({
            rowIndex: r - 1,
            excelRow: r + 1,
            position,
            firstName: first,
            lastName: get(c.last),
            id: get(c.id).toLowerCase(),
            email: get(c.email),
            date,
            start,
            end,
            isMentor: MENTOR_POSITION.test(position),
            notes: get(c.notes),
        });
        dateSet.add(date);
    }

    return {
        sheetName,
        rows,
        dates: [...dateSet].sort(),
        buffer,
        fileName,
    };
}
