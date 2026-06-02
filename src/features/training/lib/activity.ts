import type { ActivityKey } from "../types";

/** Map the OJT "Scheduled for..." value to an internal activity key. */
export function toActivityKey(scheduledFor: string): ActivityKey {
    const s = (scheduledFor || "").toLowerCase();

    if (s.includes("shadow")) return "shadow";
    if (s.includes("phone")) return "phones";
    if (s.includes("canvas")) return "canvas";
    if (s.includes("mail") || s.includes("chat")) return "emails";

    return "emails";
}

/** Label */
export const ACTIVITY_LABEL: Record<ActivityKey, string> = {
    emails: "emails/chats",
    phones: "phones",
    canvas: "Canvas",
    shadow: "TM shadow",
};

export const ACTIVITY_KEYS: ActivityKey[] = [
    "emails",
    "phones",
    "canvas",
    "shadow",
];
