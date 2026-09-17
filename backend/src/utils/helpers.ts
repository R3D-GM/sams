/** Normalise any date input to midnight UTC so a session maps to one calendar day. */
export function normaliseDate(input: string | Date): Date {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Format a sequential number into a readable student id. */
export function formatStudentId(n: number): string {
  return `STU-${String(n).padStart(5, "0")}`;
}
