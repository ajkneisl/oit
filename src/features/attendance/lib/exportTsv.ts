/**
 * Convert the output grid into somethign that can be pasted back into sheets.
 */
export function toTsv(rows: string[][]): string {
    return rows.map((r) => r.join("\t")).join("\n");
}
