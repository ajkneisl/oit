import { useState } from "react";
import AttendanceApp from "./features/attendance/AttendanceApp";
import TrainingApp from "./features/training/TrainingApp";

type Tab = "training" | "attendance";

const TABS: { key: Tab; label: string }[] = [
    { key: "attendance", label: "Attendance" },
    { key: "training", label: "Training" },
];

export default function App() {
    const [tab, setTab] = useState<Tab>("attendance");

    return (
        <div>
            <div className="sticky top-0 z-10 border-b border-line bg-bg/95 backdrop-blur">
                <nav className="mx-auto flex max-w-[1100px] items-center gap-1 px-5">
                    <span className="mr-5 py-3 font-semibold tracking-tight">
                        OIT
                    </span>
                    {TABS.map((t) => {
                        const active = t.key === tab;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`-mb-px cursor-pointer border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                                    active
                                        ? "border-accent text-text"
                                        : "border-transparent text-muted hover:text-text"
                                }`}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {tab === "training" ? <TrainingApp /> : <AttendanceApp />}
        </div>
    );
}
