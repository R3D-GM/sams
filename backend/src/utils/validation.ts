import { z } from "zod";

// International-friendly phone validation: 7-15 digits, optional leading +
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,18}$/u, "Enter a valid phone number");

export const studentSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(100),
  phone: phoneSchema,
  // A student can belong to one or more departments at once.
  departmentIds: z.array(z.string().uuid()).min(1, "Select at least one department"),
  universityDepartment: z.string().trim().max(100).optional().or(z.literal("")),
  batch: z.string().trim().min(1, "Batch is required").max(60),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).default("OTHER"),
  email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const studentUpdateSchema = studentSchema.partial();

export const attendanceEntrySchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(["PRESENT", "ABSENT", "LATE"]),
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
