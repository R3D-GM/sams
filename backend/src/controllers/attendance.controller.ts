import type { Response } from "express";
import { prisma } from "../lib/prisma";
import { attendanceSaveSchema } from "../utils/validation";
import { normaliseDate } from "../utils/helpers";
import { ownsDepartment } from "../utils/authz";
import type { AuthRequest } from "../middleware/auth";

/**
 * Resolves and authorises the departmentId to use for an attendance
 * operation. A leader is always forced to their own department, regardless
 * of what they pass in. Admin must pass one explicitly. Throws a 403-style
 * response (via the returned null) if the caller doesn't own the department.
 */
function resolveDepartmentId(req: AuthRequest, res: Response, provided: string | undefined): string | null {
  const isAdmin = req.user!.role === "SUPER_ADMIN";
  const departmentId = isAdmin ? provided : req.user!.departmentId ?? undefined;
  if (!departmentId) {
    res.status(400).json({ message: "departmentId is required" });
    return null;
  }
  if (!ownsDepartment(req.user!, departmentId)) {
    res.status(403).json({ message: "You don't have permission for that department" });
    return null;
  }
  return departmentId;
}

/** Attendance sheet for one date + one department: every active member of that department, plus any saved record. */
export async function getSheet(req: AuthRequest, res: Response) {
  const departmentId = resolveDepartmentId(req, res, req.query.departmentId ? String(req.query.departmentId) : undefined);
  if (!departmentId) return;

  const date = normaliseDate(String(req.query.date ?? new Date().toISOString()));
  const where: any = { status: "ACTIVE", memberships: { some: { departmentId } } };
  if (req.query.batch) where.batch = String(req.query.batch);

  const students = await prisma.student.findMany({ where, orderBy: { fullName: "asc" } });
  const records = await prisma.attendance.findMany({
    where: { date, departmentId, studentId: { in: students.map((s) => s.id) } },
  });
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  res.json({
    date: date.toISOString(),
    departmentId,
    saved: records.length > 0,
    rows: students.map((s) => ({
      studentId: s.id,
      code: s.studentId,
      fullName: s.fullName,
      batch: s.batch,
      status: byStudent.get(s.id)?.status ?? null,
      notes: byStudent.get(s.id)?.notes ?? "",
    })),
  });
}

/**
 * Save (or update) attendance for a date + department.
 * Uses upsert on the unique [studentId, departmentId, date] triple so
 * duplicates are impossible. Every entry's student is verified to actually
 * be a member of the target department first, so a leader can't write
 * attendance for students outside their department (or another department's
 * session for a student who happens to also be in theirs).
 */
export async function saveAttendance(req: AuthRequest, res: Response) {
  const body = attendanceSaveSchema.parse(req.body);
  const departmentId = resolveDepartmentId(req, res, body.departmentId);
  if (!departmentId) return;

  const date = normaliseDate(body.date);

  const allowedIds = new Set(
    (
      await prisma.student.findMany({
        where: {
          id: { in: body.entries.map((e) => e.studentId) },
          memberships: { some: { departmentId } },
        },
        select: { id: true },
      })
    ).map((s) => s.id),
  );
  const entries = body.entries.filter((e) => allowedIds.has(e.studentId));
  if (entries.length === 0) return res.status(403).json({ message: "No students in scope to save" });

  await prisma.$transaction(
    entries.map((e) =>
      prisma.attendance.upsert({
        where: { studentId_departmentId_date: { studentId: e.studentId, departmentId, date } },
        create: { studentId: e.studentId, departmentId, date, status: e.status, notes: e.notes || null },
        update: { status: e.status, notes: e.notes || null },
      }),
    ),
  );

  res.json({ message: "Attendance saved", date: date.toISOString(), departmentId, count: entries.length });
}

/**
 * All sessions (grouped by date + department) with counts and percentage.
 * A leader only ever sees their own department's sessions. Admin can pass
 * departmentId to narrow, or omit it to see every department's sessions.
 */
export async function listSessions(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 10)));
  const isAdmin = req.user!.role === "SUPER_ADMIN";

  const where: any = {};
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = normaliseDate(String(req.query.from));
    if (req.query.to) where.date.lte = normaliseDate(String(req.query.to));
  }
  if (!isAdmin) {
    where.departmentId = req.user!.departmentId ?? "__none__";
  } else if (req.query.departmentId) {
    where.departmentId = String(req.query.departmentId);
  }
  if (req.query.studentId) where.studentId = String(req.query.studentId);

  const studentFilter: any = {};
  if (req.query.batch) studentFilter.batch = String(req.query.batch);
  if (Object.keys(studentFilter).length) where.student = studentFilter;

  const records = await prisma.attendance.findMany({ where, include: { department: true } });
  const map = new Map<string, { date: string; departmentId: string; departmentName: string; present: number; absent: number; late: number }>();
  for (const r of records) {
    const key = `${r.date.toISOString()}||${r.departmentId}`;
    const row = map.get(key) ?? { date: r.date.toISOString(), departmentId: r.departmentId, departmentName: r.department.name, present: 0, absent: 0, late: 0 };
    if (r.status === "PRESENT") row.present++;
    else if (r.status === "LATE") row.late++;
    else row.absent++;
    map.set(key, row);
  }
  const all = [...map.values()]
    .map((s) => {
      const total = s.present + s.absent + s.late;
      return { ...s, total, percentage: total ? ((s.present + s.late) / total) * 100 : 0 };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  res.json({
    items: all.slice((page - 1) * pageSize, page * pageSize),
    total: all.length,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(all.length / pageSize)),
  });
}

/** Detail of a single session (date + department), scoped to the caller. */
export async function getSession(req: AuthRequest, res: Response) {
  const departmentId = resolveDepartmentId(req, res, req.query.departmentId ? String(req.query.departmentId) : undefined);
  if (!departmentId) return;

  const date = normaliseDate(String(req.params.date));
  const records = await prisma.attendance.findMany({
    where: { date, departmentId },
    include: { student: true, department: true },
    orderBy: { student: { fullName: "asc" } },
  });
  res.json({
    date: date.toISOString(),
    departmentId,
    departmentName: records[0]?.department.name,
    records: records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      code: r.student.studentId,
      fullName: r.student.fullName,
      batch: r.student.batch,
      status: r.status,
      notes: r.notes ?? "",
    })),
  });
}

export async function deleteSession(req: AuthRequest, res: Response) {
  const departmentId = resolveDepartmentId(req, res, req.query.departmentId ? String(req.query.departmentId) : undefined);
  if (!departmentId) return;

  const date = normaliseDate(String(req.params.date));
  const { count } = await prisma.attendance.deleteMany({ where: { date, departmentId } });
  res.json({ message: "Session deleted", count });
}
