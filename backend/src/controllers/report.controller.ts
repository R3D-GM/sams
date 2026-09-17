import type { Response } from "express";
import { prisma } from "../lib/prisma";
import { normaliseDate } from "../utils/helpers";
import { departmentScope } from "../utils/authz";
import type { AuthRequest } from "../middleware/auth";

function pct(present: number, total: number) {
  return total ? Number(((present / total) * 100).toFixed(1)) : 0;
}

/** Dashboard summary cards + recent sessions, scoped to the caller's department. */
export async function dashboard(req: AuthRequest, res: Response) {
  const today = normaliseDate(new Date());
  const scope = departmentScope(req.user!);
  const [totalStudents, activeStudents, todayRecords, allRecords] = await Promise.all([
    prisma.student.count({ where: scope }),
    prisma.student.count({ where: { ...scope, status: "ACTIVE" } }),
    prisma.attendance.findMany({ where: { date: today, student: scope } }),
    prisma.attendance.findMany({ where: { student: scope }, select: { status: true, date: true } }),
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
  const where: any = { student: departmentScope(req.user!) };
  if (req.query.from || req.query.to) {
    where.date = {};
    if (req.query.from) where.date.gte = normaliseDate(String(req.query.from));
    if (req.query.to) where.date.lte = normaliseDate(String(req.query.to));
  }
  const records = await prisma.attendance.findMany({ where, include: { student: { include: { department: true } } } });

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

  const byStudent = group((r) => `${r.student.fullName}||${r.student.studentId}` as string).map((s) => {
    const [name, code] = s.name.split("||");
    return { ...s, name, code };
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
    totalSessions: new Set(records.map((r) => r.date.toISOString())).size,
    totalRecords: records.length,
    byStudent: byStudent.sort((a, b) => b.percentage - a.percentage),
    byDepartment: group((r) => r.student.department.name),
    byBatch: group((r) => r.student.batch),
    mostAbsent: [...byStudent].sort((a, b) => b.absent - a.absent).slice(0, 10),
    mostConsistent: [...byStudent].sort((a, b) => b.percentage - a.percentage || b.total - a.total).slice(0, 10),
    monthly,
    weekly,
  });
}

/** Full database export (JSON) for Settings > Backup. SUPER_ADMIN only (enforced in routes). */
export async function backup(_req: AuthRequest, res: Response) {
  const [departments, students, attendances] = await Promise.all([
    prisma.department.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.student.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.attendance.findMany({ orderBy: { date: "asc" } }),
  ]);
  res.json({ version: 2, exportedAt: new Date().toISOString(), departments, students, attendances });
}

/** Restore from a backup file produced by /reports/backup. Replaces existing data. SUPER_ADMIN only. */
export async function restore(req: AuthRequest, res: Response) {
  const { departments = [], students = [], attendances = [] } = req.body ?? {};
  if (!Array.isArray(departments) || !Array.isArray(students) || !Array.isArray(attendances)) {
    return res.status(400).json({ message: "Invalid backup file" });
  }
  await prisma.$transaction([
    prisma.attendance.deleteMany({}),
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
        departmentId: s.departmentId,
        batch: s.batch,
        gender: s.gender,
        email: s.email ?? null,
        status: s.status,
        createdAt: new Date(s.createdAt),
      })),
    }),
    prisma.attendance.createMany({
      data: attendances.map((a: any) => ({
        id: a.id,
        studentId: a.studentId,
        date: new Date(a.date),
        status: a.status,
        notes: a.notes ?? null,
        createdAt: new Date(a.createdAt),
      })),
    }),
  ]);
  res.json({ message: "Database restored", departments: departments.length, students: students.length, attendances: attendances.length });
}

/** Global search across students, scoped to the caller's department. */
export async function search(req: AuthRequest, res: Response) {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json({ students: [] });
  const students = await prisma.student.findMany({
    where: {
      ...departmentScope(req.user!),
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { studentId: { contains: q, mode: "insensitive" } },
        { batch: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { department: true },
    take: 8,
  });
  res.json({ students });
}
