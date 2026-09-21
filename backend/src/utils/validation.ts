import { z } from "zod";

// Ethiopian phone number: must start with +251 followed by exactly 9 digits, e.g. +251912345678
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+251\d{9}$/, "Phone number must start with +251 and be followed by 9 digits, e.g. +251912345678");

export const studentSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(100),
  phone: phoneSchema,
  // A student can belong to one or more departments at once.
  departmentIds: z.array(z.string().uuid()).min(1, "Select at least one department"),
  universityDepartment: z
    .string()
    .trim()
    .min(1, "University department is required")
    .max(100)
    .refine((v) => !/^\d+$/.test(v), "University department must be text, not only numbers"),
  // Batch must be exactly 4 numeric digits, e.g. 2017 — not a fixed list, any 4-digit value is accepted.
  batch: z.string().trim().regex(/^\d{4}$/, "Batch must be exactly 4 digits, e.g. 2017"),
  gender: z.enum(["MALE", "FEMALE"]).default("MALE"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const studentUpdateSchema = studentSchema.partial();

export const attendanceEntrySchema = z.object({
  studentId: z.string().uuid(),
  // "Late" has been removed as a selectable attendance status.
  status: z.enum(["PRESENT", "ABSENT"]),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
});

export const attendanceSaveSchema = z.object({
  date: z.string().min(1),
  // Which department's session this batch of entries belongs to.
  departmentId: z.string().uuid("Department is required"),
  entries: z.array(attendanceEntrySchema).min(1, "No entries to save"),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});
