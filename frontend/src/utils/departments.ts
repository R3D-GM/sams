/**
 * Departments are identified everywhere in the app by their database `id`
 * (a UUID) — never by name. This file only changes what NAME is shown to
 * the user; it has no effect on scoping, permissions, filtering, or any
 * other logic, all of which key off `id`.
 *
 * The keys below must match the Department.name values exactly as seeded
 * in the database (see backend/prisma/seed.ts).
 */
const DEPARTMENT_LABELS: Record<string, string> = {
  "Mezmur": "መዝሙር ክፍል",
  "Siel": "ስነ-ስዕል ክፍል",
  "Sine Tsihuf": "ስነ-ፅሁፍ ክፍል",
  "Mezmure and Kflat": "መዝሙር እና ስነ-ጥበባት ክፍል",
};

/** Returns the Amharic display label for a department's internal name, or the original name if unrecognised. */
export function departmentLabel(name: string | null | undefined): string {
  if (!name) return "";
  return DEPARTMENT_LABELS[name] ?? name;
}
