import { useRef } from "react";

interface Props {
    label: string;
    hint: string;
    fileName?: string;
    required?: boolean;
    onFile: (buffer: ArrayBuffer, name: string) => void;
}

export function FilePicker({ label, hint, fileName, required, onFile }: Props) {
    const inputRef = useRef<HTMLInputElement>(null);

    async function handle(file: File | undefined) {
        if (!file) return;
        const buf = await file.arrayBuffer();
        onFile(buf, file.name);
    }

    const loaded = Boolean(fileName);

    return (
        <div
            className={`cursor-pointer rounded-xl border-[1.5px] border-dashed p-[18px] transition-[border-color,background-color] duration-150 hover:border-accent hover:bg-panel ${
                loaded ? "border-solid border-ok bg-panel" : "border-line"
            }`}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
                e.preventDefault();
                void handle(e.dataTransfer.files[0]);
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                hidden
                onChange={(e) => void handle(e.target.files?.[0])}
            />
            <div className="font-semibold">
                {label}{" "}
                {required && (
                    <span className="ml-1.5 text-[11px] font-medium text-warn">
                        required
                    </span>
                )}
            </div>
            <div
                className={`mt-1.5 text-[13px] ${loaded ? "text-ok" : "text-muted"}`}
            >
                {fileName ? `✓ ${fileName}` : hint}
            </div>
        </div>
    );
}
