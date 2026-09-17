import type { AuthUser } from "../middleware/auth";

/**
 * Prisma `where` filter that scopes a query to the caller's department.
 * SUPER_ADMIN gets no filter (sees every department).
 * TEACHER is restricted to their own department — falls back to an
 * impossible value if somehow null, so it fails closed instead of open.
 */
export function departmentScope(user: AuthUser): { departmentId?: string } {
  if (user.role === "SUPER_ADMIN") return {};
  return { departmentId: user.departmentId ?? "__none__" };
}

/** Guards a specific record's departmentId against the caller's own. */
export function ownsDepartment(user: AuthUser, departmentId: string | null | undefined) {
  if (user.role === "SUPER_ADMIN") return true;
  return user.departmentId != null && user.departmentId === departmentId;
}
