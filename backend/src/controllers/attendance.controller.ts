import type { Response } from "express";
import { prisma } from "../lib/prisma";
import { attendanceSaveSchema } from "../utils/validation";
import { normaliseDate } from "../utils/helpers";
import { departmentScope } from "../utils/authz";
import type { AuthRequest } from "../middleware/auth";

/** Attendance sheet for one date: every active student (in scope) plus any saved record. */
export async function getSheet(req: AuthRequest, res: Response) {
  const date = normaliseDate(String(req.query.date ?? new Date().toISOString()));
  const where: any = { status: "ACTIVE", ...departmentScope(req.user!) };
  if (req.query.departmentId) where.departmentId = String(req.query.departmentId);
  if (req.query.batch) where.batch = String(req.query.batch);

  const students = await prisma.student.findMany({ where, include: { department: true }, orderBy: { fullName: "asc" } });
  const records = await prisma.attendance.findMany({ where: { date, studentId: { in: students.map((s) => s.id) } } });
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  res.json({
    date: date.toISOString(),
    saved: records.length > 0,
    rows: students.map((s) => ({
      studentId: s.id,
      code: s.studentId,
      fullName: s.fullName,
      department: s.department.name,
      batch: s.batch,
      status: byStudent.get(s.id)?.status ?? null,
      notes: byStudent.get(s.id)?.notes ?? "",
    })),
  });
}

/**
 * Save (or update) attendance for a date.
 * Uses upsert on the unique [studentId, date] pair so duplicates are impossible.
 * Every entry's student is verified to be in the caller's scope first, so a
 * teacher can't write attendance for another department's students.
 */
export async function saveAttendance(req: AuthRequest, res: Response) {
  const body = attendanceSaveSchema.parse(req.body);
  const date = normaliseDate(body.date);

  const allowedIds = new Set(
    (
      await prisma.student.findMany({
        where: { id: { in: body.entries.map((e) => e.studentId) }, ...departmentScope(req.user!) },
        select: { id: true },
      })
    ).map((s) => s.id),
  );
  const entries = body.entries.filter((e) => allowedIds.has(e.studentId));
  if (entries.length === 0) return res.status(403).json({ message: "No students in scope to save" });

  await prisma.$transaction(
    entries.map((e) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId: e.studentId, date } },
        create: { studentId: e.studentId, date, status: e.status, notes: e.notes || null },
        update: { status: e.status, notes: e.notes || null },
      }),
    ),
  );

  res.json({ message: "Attendance saved", date: date.toISOString(), count: entries.length });
}

/** All sessions (grouped by date) with counts and percentage, scoped to the caller. */
export async function listSessions(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 10)));
  const where: any = {};
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = normaliseDate(String(req.query.from));
    if (req.query.to) where.date.lte = normaliseDate(String(req.query.to));
  }
  const studentFilter: any = { ...departmentScope(req.user!) };
  if (req.query.departmentId) studentFilter.departmentId = String(req.query.departmentId);
  if (req.query.batch) studentFilter.batch = String(req.query.batch);
  if (req.query.studentId) where.studentId = String(req.query.studentId);
  where.student = studentFilter;

  const records = await prisma.attendance.findMany({ where, include: { student: true } });
  const map = new Map<string, { date: string; present: number; absent: number; late: number }>();
  for (const r of records) {
    const key = r.date.toISOString();
    const row = map.get(key) ?? { date: key, present: 0, absent: 0, late: 0 };
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

/** Detail of a single session date, scoped to the caller's department. */
export async function getSession(req: AuthRequest, res: Response) {
  const date = normaliseDate(String(req.params.date));
  const records = await prisma.attendance.findMany({
    where: { date, student: departmentScope(req.user!) },
    include: { student: { include: { department: true } } },
    orderBy: { student: { fullName: "asc" } },
  });
  res.json({
    date: date.toISOString(),
    records: records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      code: r.student.studentId,
      fullName: r.student.fullName,
      department: r.student.department.name,
      batch: r.student.batch,
      status: r.status,
      notes: r.notes ?? "",
    })),
  });
}

export async function deleteSession(req: AuthRequest, res: Response) {
  const date = normaliseDate(String(req.params.date));
  const { count } = await prisma.attendance.deleteMany({
    where: { date, student: departmentScope(req.user!) },
  });
  res.json({ message: "Session deleted", count });
}
