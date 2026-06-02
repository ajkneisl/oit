import { useMemo, useState } from "react";
import type { AbsenceEvent, ParsedTracker, PointChange } from "./types";
import { parseTracker } from "./lib/parseTracker";
import { parseAbsences } from "./lib/parseAbsences";
import { computeUpdates, formatPoints } from "./lib/calc";
import { toTsv } from "./lib/exportTsv";
import { parseFlexibleDate, startOfDayUTC } from "./lib/dates";
import { FilePicker } from "../../components/FilePicker";

const bannerWarn =
    "mb-4 rounded-lg border border-[#5a4a22] bg-warn-bg px-3.5 py-2.5 text-warn";
const sectionH =
    "mt-[26px] mb-2.5 text-[15px] uppercase tracking-[0.04em] text-muted";
const statBox = "rounded-[10px] border border-line bg-panel px-4 py-2.5";
const statLabel = "text-xs uppercase tracking-[0.03em] text-muted";
const warnList = "m-0 list-disc pl-[18px]";
const th =
    "border-b border-line px-2.5 py-2 text-left align-top text-xs font-semibold uppercase tracking-[0.03em] text-muted";
const td = "border-b border-line px-2.5 py-2 text-left align-top";

function todayInputValue(): string {
    const d = startOfDayUTC();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
        d.getUTCDate(),
    ).padStart(2, "0")}`;
}

export default function AttendanceApp() {
    const [trackerText, setTrackerText] = useState("");
    const [absences, setAbsences] = useState<AbsenceEvent[] | null>(null);
    const [absFileName, setAbsFileName] = useState<string>("");
    const [runDate] = useState(todayInputValue());
    const [showAll, setShowAll] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");

    function loadAbsences(buffer: ArrayBuffer, name: string) {
        try {
            setAbsences(parseAbsences(buffer));
            setAbsFileName(name);
            setError("");
        } catch (e) {
            setAbsences(null);
            setAbsFileName("");
            setError(`Absences import failed: ${(e as Error).message}`);
        }
    }

    const tracker = useMemo<ParsedTracker | null>(() => {
        if (!trackerText.trim()) return null;
        try {
            return parseTracker(trackerText);
        } catch {
            return null;
        }
    }, [trackerText]);

    const trackerError = useMemo(() => {
        if (!trackerText.trim()) return "";
        try {
            parseTracker(trackerText);
            return "";
        } catch (e) {
            return (e as Error).message;
        }
    }, [trackerText]);

    const today = useMemo(
        () => parseFlexibleDate(runDate) ?? startOfDayUTC(),
        [runDate],
    );

    const result = useMemo(() => {
        if (!tracker || !absences) return null;
        return computeUpdates(tracker, absences, today);
    }, [tracker, absences, today]);

    const changedRows = result?.changes.filter((c) => c.changed) ?? [];
    const visibleRows: PointChange[] = result
        ? showAll
            ? result.changes
            : changedRows
        : [];

    const outputTsv = result ? toTsv(result.outputRows) : "";

    async function copyOutput() {
        if (!outputTsv) return;
        try {
            await navigator.clipboard.writeText(outputTsv);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setError("Clipboard copy was blocked, please manually copy.");
        }
    }

    return (
        <div className="mx-auto max-w-[1100px] px-5 pt-6 pb-20">
            <header className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <h1 className="m-0 text-[22px]">
                        Attendance Points Updater
                    </h1>
                    <p className="mt-1 mb-0 max-w-[680px] text-muted">
                        Paste the <strong>Attendance Tracker</strong> sheet and
                        upload the weekly <strong>W2W absences</strong> export.
                    </p>
                </div>
            </header>

            {error && (
                <div className="mb-4 rounded-lg border border-[#5a2a2a] bg-err-bg px-3.5 py-2.5 text-err">
                    {error}
                </div>
            )}

            <section className="mb-[18px] grid grid-cols-[1fr_360px] items-start gap-4 max-[820px]:grid-cols-1">
                <div>
                    <div className="mb-1.5 font-semibold">
                        Attendance Tracker{" "}
                        <span className="ml-1.5 text-[11px] font-medium text-warn">
                            required
                        </span>
                    </div>

                    <textarea
                        className="min-h-[150px] w-full resize-y rounded-[10px] border border-line bg-panel px-3 py-2.5 font-mono text-xs leading-[1.5] text-text focus:border-accent focus:outline-none"
                        placeholder={
                            "Paste the Attendance Tracker here (including the header row)."
                        }
                        value={trackerText}
                        onChange={(e) => setTrackerText(e.target.value)}
                    />
                    {trackerError && (
                        <div className={`mt-2 ${bannerWarn}`}>
                            {trackerError}
                        </div>
                    )}
                    {tracker && (
                        <div className="mt-1.5 text-[13px] text-muted">
                            ✓ {tracker.rows.length} employees parsed
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3.5">
                    <FilePicker
                        label="W2W Absences"
                        hint="Upload the week of W2W absences Excel file."
                        fileName={
                            absences
                                ? `${absFileName}: ${absences.length} rows`
                                : undefined
                        }
                        required
                        onFile={loadAbsences}
                    />
                </div>
            </section>

            {result && (
                <>
                    <h2 className={sectionH}>Summary</h2>

                    <div className="mt-1.5 mb-1 flex flex-wrap gap-[22px]">
                        <div className={statBox}>
                            <div className="text-xl font-bold">
                                {changedRows.length}
                            </div>
                            <div className={statLabel}>Employees changed</div>
                        </div>

                        <div className={statBox}>
                            <div className="text-xl font-bold">
                                {absences!.length}
                            </div>
                            <div className={statLabel}>Absence rows</div>
                        </div>

                        <div className={statBox}>
                            <div className="text-xl font-bold">
                                {result.continued.length}
                            </div>
                            <div className={statLabel}>Continued (skipped)</div>
                        </div>

                        <div className={statBox}>
                            <div className="text-xl font-bold">
                                {result.unmatched.length +
                                    result.unknown.length}
                            </div>
                            <div className={statLabel}>Need review</div>
                        </div>
                    </div>

                    {(result.unmatched.length > 0 ||
                        result.unknown.length > 0 ||
                        result.continued.length > 0) && (
                        <div className={bannerWarn}>
                            {result.unmatched.length > 0 && (
                                <>
                                    <strong>
                                        No matching employee in tracker:
                                    </strong>

                                    <ul className={warnList}>
                                        {result.unmatched.map((e, i) => (
                                            <li
                                                key={`u${i}`}
                                                className="my-0.5"
                                            >
                                                <b>{e.employee}</b>: "{e.note}"
                                                ({e.rawDate || "no date"})
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            {result.unknown.length > 0 && (
                                <>
                                    <strong>Unrecognized note:</strong>
                                    <ul className={warnList}>
                                        {result.unknown.map((e, i) => (
                                            <li
                                                key={`k${i}`}
                                                className="my-0.5"
                                            >
                                                <b>{e.employee}</b>: "{e.note}"
                                                ({e.rawDate || "no date"})
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                            {result.continued.length > 0 && (
                                <>
                                    <strong>Skipped due to "continued"</strong>
                                    <ul className={warnList}>
                                        {result.continued.map((e, i) => (
                                            <li
                                                key={`c${i}`}
                                                className="my-0.5"
                                            >
                                                <b>{e.employee}</b>: "{e.note}"
                                                ({e.rawDate || "no date"})
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    )}

                    <h2 className={sectionH}>
                        Changes
                        <label className="ml-3.5 text-[13px] tracking-normal normal-case text-muted">
                            <input
                                type="checkbox"
                                checked={showAll}
                                onChange={(e) => setShowAll(e.target.checked)}
                                className="mr-1.5"
                            />
                            show unchanged too
                        </label>
                    </h2>

                    {visibleRows.length === 0 ? (
                        <p className="text-[13px] text-muted">
                            No point changes this run.
                        </p>
                    ) : (
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={th}>Employee</th>

                                    <th className={`${th} text-right`}>
                                        Points
                                    </th>

                                    <th className={th}>What changed</th>

                                    <th className={`${th} whitespace-nowrap`}>
                                        Last Changed
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleRows.map((c) => {
                                    const delta = c.newPoints - c.oldPoints;

                                    return (
                                        <tr key={c.rowIndex}>
                                            <td
                                                className={`${td} font-semibold whitespace-nowrap`}
                                            >
                                                {c.name}
                                            </td>

                                            <td
                                                className={`${td} text-right whitespace-nowrap tabular-nums`}
                                            >
                                                {formatPoints(c.oldPoints)} →{" "}
                                                <strong>
                                                    {formatPoints(c.newPoints)}
                                                </strong>
                                                {delta !== 0 && (
                                                    <span
                                                        className={
                                                            delta < 0
                                                                ? "text-down"
                                                                : "text-up"
                                                        }
                                                    >
                                                        {" "}
                                                        ({delta > 0 ? "+" : ""}
                                                        {formatPoints(delta)})
                                                    </span>
                                                )}
                                            </td>

                                            <td className={`${td} text-muted`}>
                                                {c.details.length === 0 ? (
                                                    <span className="text-muted">
                                                        Last Ran updated only
                                                    </span>
                                                ) : (
                                                    c.details.map((d, i) => (
                                                        <div key={i}>{d}</div>
                                                    ))
                                                )}
                                            </td>

                                            <td
                                                className={`${td} whitespace-nowrap`}
                                            >
                                                {c.changed &&
                                                c.oldLastChanged !==
                                                    c.newLastChanged ? (
                                                    <>
                                                        {c.oldLastChanged ||
                                                            "—"}{" "}
                                                        →{" "}
                                                        <strong>
                                                            {c.newLastChanged}
                                                        </strong>
                                                    </>
                                                ) : (
                                                    <span className="text-muted">
                                                        {c.oldLastChanged ||
                                                            "—"}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    <h2 className={sectionH}>Updated sheet</h2>
                    <div className="flex items-center justify-between gap-3">
                        <button
                            className="cursor-pointer rounded-lg border border-accent-2 bg-accent px-3.5 py-2 font-semibold text-white hover:bg-accent-2"
                            onClick={copyOutput}
                        >
                            {copied ? "✓ Copied" : "⧉ Copy sheet"}
                        </button>
                    </div>
                    <textarea
                        className="min-h-[220px] w-full resize-y rounded-[10px] border border-line bg-panel px-3 py-2.5 font-mono text-xs leading-[1.5] whitespace-pre text-text"
                        readOnly
                        value={outputTsv}
                        onFocus={(e) => e.target.select()}
                    />
                </>
            )}
        </div>
    );
}
