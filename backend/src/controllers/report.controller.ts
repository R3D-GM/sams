import type { Response } from "express";
import { prisma } from "../lib/prisma";
import { normaliseDate } from "../utils/helpers";
import { studentScope } from "../utils/authz";
import type { AuthRequest } from "../middleware/auth";

function pct(present: number, total: number) {
  return total ? Number(((present / total) * 100).toFixed(1)) : 0;
}

/** Prisma `where` filter for Attendance queries — leaders see only their own department's records. */
function attendanceDeptScope(user: AuthRequest["user"]) {
  if (user!.role === "SUPER_ADMIN") return {};
  return { departmentId: user!.departmentId ?? "__none__" };
}

/** Dashboard summary cards + recent sessions, scoped to the caller's department. */
export async function dashboard(req: AuthRequest, res: Response) {
  const today = normaliseDate(new Date());
  const studentWhere = studentScope(req.user!);
  const attendanceWhere = attendanceDeptScope(req.user);

  const [totalStudents, activeStudents, todayRecords, allRecords] = await Promise.all([
    prisma.student.count({ where: studentWhere }),
    prisma.student.count({ where: { ...studentWhere, status: "ACTIVE" } }),
    prisma.attendance.findMany({ where: { date: today, ...attendanceWhere } }),
    prisma.attendance.findMany({ where: attendanceWhere, select: { status: true, date: true } }),
  ]);

  const presentToday = todayRecords.filter((r) => r.status !== "ABSENT").length;
  const absentToday = todayRecords.filter((r) => r.status === "ABSENT").length;
  const overall = pct(allRecords.filter((r) => r.status !== "ABSENT").length, allRecords.length);

  const byDate = new Map<string, { present: number; total: number }>();
  for (const r of allRecords) {
    const key = r.date.toISOString();
    const row = byDate.get(key) ?? { present: 0, total: 0 };
    row.total++;
    if (r.status !== "ABSENT") row.present++;
    byDate.set(key, row);
  }
  const recentSessions = [...byDate.entries()]
    .map(([date, v]) => ({ date, present: v.present, total: v.total, percentage: pct(v.present, v.total) }))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 6);

  res.json({
    totalStudents,
    activeStudents,
    presentToday,
    absentToday,
    attendanceTakenToday: todayRecords.length > 0,
    overallPercentage: overall,
    recentSessions,
  });
}

/** Full report payload used by the Reports page and exports, scoped to the caller's department. */
export async function reports(req: AuthRequest, res: Response) {
  const isAdmin = req.user!.role === "SUPER_ADMIN";
  const where: any = { ...attendanceDeptScope(req.user) };
  if (isAdmin && req.query.departmentId) where.departmentId = String(req.query.departmentId);
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = normaliseDate(String(req.query.from));
    if (req.query.to) where.date.lte = normaliseDate(String(req.query.to));
  }
  const records = await prisma.attendance.findMany({ where, include: { student: true, department: true } });

  const group = <T extends string>(key: (r: (typeof records)[number]) => T) => {
    const map = new Map<T, { present: number; total: number }>();
    for (const r of records) {
      const k = key(r);
      const row = map.get(k) ?? { present: 0, total: 0 };
      row.total++;
      if (r.status !== "ABSENT") row.present++;
      map.set(k, row);
    }
    return [...map.entries()].map(([name, v]) => ({
      name,
      present: v.present,
      absent: v.total - v.present,
      total: v.total,
      percentage: pct(v.present, v.total),
    }));
  };

  // Fairness fix (same principle as the student profile page): a student's
  // percentage is measured against every session THEIR department(s) held
  // within this date range — not just the count of records that happen to
  // exist for them. Otherwise a recently-joined student who attends their
  // one available session shows a misleading 100%.
  const sessionsByDept = new Map<string, Set<string>>();
  for (const r of records) {
    const set = sessionsByDept.get(r.departmentId) ?? new Set<string>();
    set.add(r.date.toISOString());
    sessionsByDept.set(r.departmentId, set);
  }
  const byStudentMap = new Map<string, { name: string; code: string; present: number; deptIds: Set<string> }>();
  for (const r of records) {
    const row = byStudentMap.get(r.studentId) ?? {
      name: r.student.fullName,
      code: r.student.studentId,
      present: 0,
      deptIds: new Set<string>(),
    };
    row.deptIds.add(r.departmentId);
    if (r.status === "PRESENT") row.present++;
    byStudentMap.set(r.studentId, row);
  }
  const byStudent = [...byStudentMap.values()].map((s) => {
    const total = [...s.deptIds].reduce((sum, d) => sum + (sessionsByDept.get(d)?.size ?? 0), 0);
    return { name: s.name, code: s.code, present: s.present, absent: total - s.present, total, percentage: pct(s.present, total) };
  });

  const monthly = group((r) => r.date.toISOString().slice(0, 7)).sort((a, b) => a.name.localeCompare(b.name));

  const weekly = group((r) => {
    const d = new Date(r.date);
    const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getUTCDay() + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }).sort((a, b) => a.name.localeCompare(b.name));

  res.json({
    overall: pct(records.filter((r) => r.status !== "ABSENT").length, records.length),
    totalSessions: new Set(records.map((r) => `${r.date.toISOString()}||${r.departmentId}`)).size,
    totalRecords: records.length,
    byStudent: byStudent.sort((a, b) => b.percentage - a.percentage),
    byDepartment: group((r) => r.department.name),
    byBatch: group((r) => r.student.batch),
    mostAbsent: [...byStudent].sort((a, b) => b.absent - a.absent).slice(0, 10),
    mostConsistent: [...byStudent].sort((a, b) => b.percentage - a.percentage || b.total - a.total).slice(0, 10),
    monthly,
    weekly,
  });
}

/** Full database export (JSON) for Settings > Backup. SUPER_ADMIN only (enforced in routes). */
export async function backup(_req: AuthRequest, res: Response) {
  const [departments, students, memberships, attendances] = await Promise.all([
    prisma.department.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.student.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.studentDepartment.findMany(),
    prisma.attendance.findMany({ orderBy: { date: "asc" } }),
  ]);
  res.json({ version: 3, exportedAt: new Date().toISOString(), departments, students, memberships, attendances });
}

/**
 * Restore from a backup file produced by /reports/backup. Replaces existing data.
 * SUPER_ADMIN only. Accepts version 2 backups (old single departmentId per
 * student) by converting each student's departmentId into one membership row.
 */
export async function restore(req: AuthRequest, res: Response) {
  const { version = 2, departments = [], students = [], memberships = [], attendances = [] } = req.body ?? {};
  if (!Array.isArray(departments) || !Array.isArray(students) || !Array.isArray(attendances)) {
    return res.status(400).json({ message: "Invalid backup file" });
  }

  // Version 2 backups had `departmentId` directly on each student and no
  // per-attendance departmentId — derive both from the old shape.
  const derivedMemberships =
    version >= 3
      ? memberships
      : students.filter((s: any) => s.departmentId).map((s: any) => ({ studentId: s.id, departmentId: s.departmentId }));
  const derivedAttendances =
    version >= 3
      ? attendances
      : attendances.map((a: any) => ({
          ...a,
          departmentId: students.find((s: any) => s.id === a.studentId)?.departmentId,
        }));

  await prisma.$transaction([
    prisma.attendance.deleteMany({}),
    prisma.studentDepartment.deleteMany({}),
    prisma.student.deleteMany({}),
    prisma.department.deleteMany({}),
    prisma.department.createMany({
      data: departments.map((d: any) => ({ id: d.id, name: d.name, createdAt: new Date(d.createdAt) })),
    }),
    prisma.student.createMany({
      data: students.map((s: any) => ({
        id: s.id,
        studentId: s.studentId,
        fullName: s.fullName,
        phone: s.phone,
        universityDepartment: s.universityDepartment ?? null,
        batch: s.batch,
        gender: s.gender,
        email: s.email ?? null,
        status: s.status,
        createdAt: new Date(s.createdAt),
      })),
    }),
    prisma.studentDepartment.createMany({
      data: derivedMemberships
        .filter((m: any) => m.studentId && m.departmentId)
        .map((m: any) => ({ studentId: m.studentId, departmentId: m.departmentId })),
      skipDuplicates: true,
    }),
    prisma.attendance.createMany({
      data: derivedAttendances
        .filter((a: any) => a.departmentId)
        .map((a: any) => ({
          id: a.id,
          studentId: a.studentId,
          departmentId: a.departmentId,
          date: new Date(a.date),
          status: a.status,
          notes: a.notes ?? null,
          createdAt: new Date(a.createdAt),
        })),
    }),
  ]);
  res.json({
    message: "Database restored",
    departments: departments.length,
    students: students.length,
    memberships: derivedMemberships.length,
    attendances: derivedAttendances.length,
  });
}

/** Global search across students, scoped to the caller's department. */
export async function search(req: AuthRequest, res: Response) {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json({ students: [] });
  const students = await prisma.student.findMany({
    where: {
      ...studentScope(req.user!),
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { studentId: { contains: q, mode: "insensitive" } },
        { batch: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { memberships: { include: { department: true } } },
    take: 8,
  });
  res.json({ students: students.map((s) => ({ ...s, departments: s.memberships.map((m) => m.department) })) });
}
