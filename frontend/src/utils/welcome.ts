import type { User } from "@/hooks/useAuth";

/**
 * Department-specific welcome messages in Amharic.
 * Keyed by the exact Department.name value from the database (see backend/prisma/seed.ts).
 * Add a new entry here whenever a department needs its own greeting —
 * anything not listed falls back to a generic "Welcome to <department>" message.
 */
const DEPARTMENT_WELCOME: Record<string, string> = {
  "Mezmur": "እንኳን ወደ መዝሙር ክፍል በደህና መጡ!",
  "Siel": "እንኳን ወደ ስነ-ስዕል ክፍል በደህና መጡ!",
  "Sine Tsihuf": "እንኳን ወደ ስነ-ፅሁፍ ክፍል በደህና መጡ!",
  "Mezmure and Kflat": "እንኳን ወደ መዝሙር እና ስነ - ጥበባት ክፍል በደህና መጡ!",
};

/** Shown to the super admin, who oversees every department. */
const ADMIN_WELCOME = "እንኳን ወደ መዝሙር እና ስነ - ጥበባት ክፍል በደህና መጡ!";

/** Returns the right welcome message for whoever just logged in. */
export function getWelcomeMessage(user: User | null): string {
  if (!user) return "";
  if (user.role === "SUPER_ADMIN") return ADMIN_WELCOME;
  if (user.departmentName && DEPARTMENT_WELCOME[user.departmentName]) {
    return DEPARTMENT_WELCOME[user.departmentName];
  }
  return user.departmentName ? `Welcome to ${user.departmentName}` : "Welcome back";
}