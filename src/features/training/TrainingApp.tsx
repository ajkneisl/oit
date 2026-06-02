import { useMemo, useState } from "react";
import type { ActivityKey, ParsedSchedule, TraineeStatus } from "./types";
import { parseSchedule } from "./lib/parseSchedule";
import { parseOjt } from "./lib/parseOjt";
import { generateAll, type AssignOptions } from "./lib/assign";
import { ACTIVITY_KEYS, ACTIVITY_LABEL } from "./lib/activity";
import { fmtDate, fmtTime } from "./lib/time";
import { FilePicker } from "../../components/FilePicker";

const DEFAULT_ACTIVITY: ActivityKey = "emails";

const sectionH2 =
    "mt-[22px] mb-2 text-[15px] uppercase tracking-[0.04em] text-muted";
const gridTable = "w-full border-collapse";
const th =
    "border-b border-line px-2.5 py-2 text-left align-top text-xs font-semibold uppercase tracking-[0.03em] text-muted";
const td = "border-b border-line px-2.5 py-2 text-left align-top";

export default function TrainingApp() {
    const [schedule, setSchedule] = useState<ParsedSchedule | null>(null);
    const [statusMap, setStatusMap] = useState<Map<
        string,
        TraineeStatus
    > | null>(null);
    const [overrides, setOverrides] = useState<Map<string, ActivityKey>>(
        new Map(),
    );
    const [edits, setEdits] = useState<Map<number, string>>(new Map());
    const [onlyFillBlank, setOnlyFillBlank] = useState(true);
    const [activeDate, setActiveDate] = useState<string>("");
    const [error, setError] = useState<string>("");

    function loadSchedule(buffer: ArrayBuffer, name: string) {
        try {
            const parsed = parseSchedule(buffer, name);
            setSchedule(parsed);
            setEdits(new Map());
            setOverrides(new Map());
            setActiveDate(parsed.dates[0] ?? "");
            setError("");
        } catch (e) {
            setError(`Schedule import failed: ${(e as Error).message}`);
        }
    }

    function loadOjt(buffer: ArrayBuffer) {
        try {
            setStatusMap(parseOjt(buffer));
            setError("");
        } catch (e) {
            setError(`OJT import failed: ${(e as Error).message}`);
        }
    }

    // resolved activity per trainee id (OJT value, overridden by manual choice)
    const activityById = useMemo(() => {
        const map = new Map<string, ActivityKey>();
        if (statusMap) for (const [id, s] of statusMap) map.set(id, s.activity);
        for (const [id, a] of overrides) map.set(id, a);
        return map;
    }, [statusMap, overrides]);

    const assignOpts: AssignOptions = useMemo(
        () => ({ activityById, defaultActivity: DEFAULT_ACTIVITY }),
        [activityById],
    );

    const generated = useMemo(() => {
        if (!schedule) return null;
        return generateAll(schedule.rows, schedule.dates, assignOpts);
    }, [schedule, assignOpts]);

    // distinct trainees (for the activity panel)
    const trainees = useMemo(() => {
        if (!schedule) return [];
        const seen = new Map<string, { id: string; name: string }>();
        for (const r of schedule.rows) {
            if (r.isMentor || seen.has(r.id)) continue;
            seen.set(r.id, {
                id: r.id,
                name: `${r.firstName} ${r.lastName}`.trim(),
            });
        }
        return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [schedule]);

    const day = generated?.days.find((d) => d.date === activeDate) ?? null;

    return (
        <div className="mx-auto max-w-[1100px] px-5 pt-6 pb-20">
            <header className="mb-5">
                <h1 className="m-0 text-[22px]">Trainee & Mentor Pairing</h1>

                <p className="mt-1 mb-0 max-w-[640px] text-muted">
                    Import the schedule export and generate a week of mentor
                    assignments.
                </p>
            </header>

            {error && (
                <div className="mb-4 rounded-lg border border-[#5a2a2a] bg-err-bg px-3.5 py-2.5 text-err">
                    {error}
                </div>
            )}

            <section className="mb-[18px] grid grid-cols-2 gap-3.5 max-[640px]:grid-cols-1">
                <FilePicker
                    label="W2W Week Schedule"
                    hint="Upload a .xlsx of the W2W schedule."
                    fileName={schedule?.fileName}
                    onFile={loadSchedule}
                    required
                />

                <FilePicker
                    label="OJT"
                    hint="Upload a copy of the OJT (download as .xlsx)"
                    fileName={
                        statusMap
                            ? `${statusMap.size} trainees loaded`
                            : undefined
                    }
                    onFile={(buf) => loadOjt(buf)}
                    required
                />
            </section>

            {schedule && (
                <>
                    <section className="mb-3.5 flex flex-wrap items-center gap-[18px]">
                        <label className="flex cursor-pointer items-center gap-2">
                            <input
                                type="checkbox"
                                checked={onlyFillBlank}
                                onChange={(e) =>
                                    setOnlyFillBlank(e.target.checked)
                                }
                            />
                            Preserve existing notes
                        </label>

                        {!statusMap && (
                            <span className="text-[13px] text-muted">
                                No training-status file — every trainee defaults
                                to “emails &amp; chats”. Set activities per
                                trainee below.
                            </span>
                        )}
                    </section>

                    <ActivityPanel
                        trainees={trainees}
                        statusMap={statusMap}
                        overrides={overrides}
                        onChange={(id, act) => {
                            const next = new Map(overrides);
                            next.set(id, act);
                            setOverrides(next);
                        }}
                    />

                    <nav className="mb-4 flex flex-wrap gap-1.5">
                        {schedule.dates.map((d) => {
                            const warns =
                                generated?.days.find((x) => x.date === d)
                                    ?.warnings.length ?? 0;
                            const active = d === activeDate;
                            return (
                                <button
                                    key={d}
                                    className={`relative cursor-pointer rounded-lg border px-3.5 py-2 ${
                                        active
                                            ? "border-accent-2 bg-accent text-white"
                                            : "border-line bg-panel-2 text-text hover:border-accent"
                                    }`}
                                    onClick={() => setActiveDate(d)}
                                >
                                    {fmtDate(d)}
                                    {warns > 0 && (
                                        <span
                                            className="absolute top-1 right-1 h-[7px] w-[7px] rounded-full bg-warn"
                                            title={`${warns} warning(s)`}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {day && (
                        <DayPanel
                            key={day.date}
                            day={day}
                            edits={edits}
                            onlyFillBlank={onlyFillBlank}
                            setEdit={(rowIndex, value) => {
                                const next = new Map(edits);
                                next.set(rowIndex, value);
                                setEdits(next);
                            }}
                            clearEdit={(rowIndex) => {
                                const next = new Map(edits);
                                next.delete(rowIndex);
                                setEdits(next);
                            }}
                        />
                    )}
                </>
            )}
        </div>
    );
}

function ActivityPanel({
    trainees,
    statusMap,
    overrides,
    onChange,
}: {
    trainees: Array<{ id: string; name: string }>;
    statusMap: Map<string, TraineeStatus> | null;
    overrides: Map<string, ActivityKey>;
    onChange: (id: string, act: ActivityKey) => void;
}) {
    const [open, setOpen] = useState(false);
    return (
        <section className="mb-[18px] overflow-hidden rounded-[10px] border border-line">
            <button
                className="w-full cursor-pointer bg-panel px-3.5 py-2.5 text-left font-semibold text-text hover:bg-panel-2"
                onClick={() => setOpen((o) => !o)}
            >
                {open ? "▾" : "▸"} Trainee activities ({trainees.length})
            </button>
            {open && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-4 gap-y-2 bg-panel p-3.5">
                    {trainees.map((t) => {
                        const fromOjt = statusMap?.get(t.id);
                        const current =
                            overrides.get(t.id) ??
                            fromOjt?.activity ??
                            DEFAULT_ACTIVITY;
                        return (
                            <div
                                key={t.id}
                                className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
                            >
                                <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                                    {t.name}
                                </span>
                                <select
                                    className="rounded-md border border-line bg-panel-2 px-1.5 py-1 text-text"
                                    value={current}
                                    onChange={(e) =>
                                        onChange(
                                            t.id,
                                            e.target.value as ActivityKey,
                                        )
                                    }
                                >
                                    {ACTIVITY_KEYS.map((k) => (
                                        <option key={k} value={k}>
                                            {ACTIVITY_LABEL[k]}
                                        </option>
                                    ))}
                                </select>
                                <span className="whitespace-nowrap text-[11px] text-muted">
                                    {overrides.has(t.id)
                                        ? "manual"
                                        : fromOjt
                                          ? `OJT: ${fromOjt.rawScheduledFor || "—"}`
                                          : "default"}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function DayPanel({
    day,
    edits,
    onlyFillBlank,
    setEdit,
    clearEdit,
}: {
    day: NonNullable<ReturnType<typeof generateAll>["days"][number]>;
    edits: Map<number, string>;
    onlyFillBlank: boolean;
    setEdit: (rowIndex: number, value: string) => void;
    clearEdit: (rowIndex: number) => void;
}) {
    return (
        <div>
            {day.warnings.length > 0 && (
                <div className="mb-4 rounded-lg border border-[#5a4a22] bg-warn-bg px-3.5 py-2.5 text-warn">
                    {day.warnings.map((w, i) => (
                        <div key={i}>⚠ {w}</div>
                    ))}
                </div>
            )}

            <h2 className={sectionH2}>Trainees</h2>
            <table className={gridTable}>
                <thead>
                    <tr>
                        <th className={th}>Trainee</th>
                        <th className={th}>Shift</th>
                        <th className={th}>Activity</th>
                        <th className={th}>Generated note</th>
                    </tr>
                </thead>
                <tbody>
                    {day.trainees
                        .slice()
                        .sort((a, b) => a.row.start - b.row.start)
                        .map((t) => (
                            <NoteCells
                                key={t.row.rowIndex}
                                rowIndex={t.row.rowIndex}
                                name={`${t.row.firstName} ${t.row.lastName}`}
                                shift={`${fmtTime(t.row.start)} – ${fmtTime(t.row.end)}`}
                                tag={ACTIVITY_LABEL[t.activity]}
                                generated={t.note}
                                original={t.row.notes}
                                onlyFillBlank={onlyFillBlank}
                                edits={edits}
                                setEdit={setEdit}
                                clearEdit={clearEdit}
                            />
                        ))}
                </tbody>
            </table>

            <h2 className={sectionH2}>Training mentors</h2>
            <table className={gridTable}>
                <thead>
                    <tr>
                        <th className={th}>Mentor</th>
                        <th className={th}>Shift</th>
                        <th className={th}>#</th>
                        <th className={th}>Roster note</th>
                    </tr>
                </thead>
                <tbody>
                    {day.mentors
                        .slice()
                        .sort((a, b) => a.row.start - b.row.start)
                        .map((m) => (
                            <NoteCells
                                key={m.row.rowIndex}
                                rowIndex={m.row.rowIndex}
                                name={`${m.row.firstName} ${m.row.lastName}`}
                                shift={`${fmtTime(m.row.start)} – ${fmtTime(m.row.end)}`}
                                tag={String(m.entries.length)}
                                generated={m.note}
                                original={m.row.notes}
                                onlyFillBlank={onlyFillBlank}
                                edits={edits}
                                setEdit={setEdit}
                                clearEdit={clearEdit}
                            />
                        ))}
                </tbody>
            </table>
        </div>
    );
}

function NoteCells({
    rowIndex,
    name,
    shift,
    tag,
    generated,
    original,
    onlyFillBlank,
    edits,
    setEdit,
    clearEdit,
}: {
    rowIndex: number;
    name: string;
    shift: string;
    tag: string;
    generated: string;
    original: string;
    onlyFillBlank: boolean;
    edits: Map<number, string>;
    setEdit: (rowIndex: number, value: string) => void;
    clearEdit: (rowIndex: number) => void;
}) {
    const hasOriginal = original.trim().length > 0;
    const preserved = onlyFillBlank && hasOriginal && !edits.has(rowIndex);
    const value = edits.has(rowIndex)
        ? edits.get(rowIndex)!
        : preserved
          ? original
          : generated;
    const edited = edits.has(rowIndex);
    const [copied, setCopied] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard blocked — nothing to do */
        }
    }

    return (
        <tr className={preserved ? "opacity-[0.72]" : ""}>
            <td className={`${td} font-semibold whitespace-nowrap`}>{name}</td>
            <td className={`${td} whitespace-nowrap text-muted`}>{shift}</td>
            <td className={td}>{tag}</td>
            <td className={td}>
                <textarea
                    className="min-w-[360px] w-full resize-y rounded-md border border-line bg-panel px-2 py-1.5 focus:border-accent focus:outline-none"
                    value={value}
                    rows={Math.max(2, value.split("\n").length)}
                    onChange={(e) => setEdit(rowIndex, e.target.value)}
                />

                <div className="mt-[3px] flex min-h-4 items-center gap-3">
                    <button
                        className="cursor-pointer border-0 bg-transparent p-0 text-xs text-accent hover:underline"
                        onClick={copy}
                    >
                        {copied ? "✓ copied" : "copy"}
                    </button>

                    {preserved && (
                        <span className="text-[11px] text-warn">
                            preserved existing note
                        </span>
                    )}

                    {edited && (
                        <button
                            className="cursor-pointer border-0 bg-transparent p-0 text-xs text-accent hover:underline"
                            onClick={() => clearEdit(rowIndex)}
                        >
                            reset to generated
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}
