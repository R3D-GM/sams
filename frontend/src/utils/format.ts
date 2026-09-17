import { format, parseISO } from "date-fns";

export const fmtDate = (iso: string) => format(parseISO(iso), "dd MMM yyyy");
export const fmtDay = (iso: string) => format(parseISO(iso), "EEEE, dd MMM yyyy");
export const toInputDate = (d: Date | string) => format(typeof d === "string" ? parseISO(d) : d, "yyyy-MM-dd");
export const pct = (n: number) => `${Number(n ?? 0).toFixed(1)}%`;
