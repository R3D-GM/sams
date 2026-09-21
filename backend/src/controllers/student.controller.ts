import type { Response } from "express";
import { prisma } from "../lib/prisma";
import { studentSchema, studentUpdateSchema } from "../utils/validation";
import { formatStudentId } from "../utils/helpers";
import { studentScope, ownsStudentMembership } from "../utils/authz";
import type { AuthRequest } from "../middleware/auth";

/** List students with search, filters and pagination — scoped to departments the caller can see. */
export async function listStudents(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 10)));
  const search = String(req.query.search ?? "").trim();
  const departmentId = String(req.query.departmentId ?? "");
  const batch = String(req.query.batch ?? "");
  const status = String(req.query.status ?? "");
  const universityDepartment = String(req.query.universityDepartment ?? "");

  const where: any = { AND: [studentScope(req.user!)] as any[] };
  if (search) {
    where.AND.push({
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
        { batch: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  // Extra department filter (e.g. admin narrowing the list to one department)
  // is on top of studentScope, not a replacement for it.
  if (departmentId) where.AND.push({ memberships: { some: { departmentId } } });
  if (batch) where.AND.push({ batch });
  if (status) where.AND.push({ status });
  if (universityDepartment) where.AND.push({ universityDepartment });

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { memberships: { include: { department: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  // Flatten memberships -> departments for a friendlier response shape.
  const shaped = items.map((s) => ({
    ...s,
    departments: s.memberships.map((m) => m.department),
  }));

  res.json({ items: shaped, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) });
}

/** Departments in scope, and distinct batches, used to populate filter dropdowns. */
export async function studentFacets(req: AuthRequest, res: Response) {
  const scope = studentScope(req.user!);
  const [departments, batches, universityDepartments] = await Promise.all([
    prisma.department.findMany({
      where: req.user!.role === "SUPER_ADMIN" ? {} : { id: req.user!.departmentId ?? "__none__" },
      orderBy: { name: "asc" },
    }),
    prisma.student.findMany({ where: scope, distinct: ["batch"], select: { batch: true }, orderBy: { batch: "asc" } }),
    prisma.student.findMany({
      where: { ...scope, universityDepartment: { not: null } },
      distinct: ["universityDepartment"],
      select: { universityDepartment: true },
      orderBy: { universityDepartment: "asc" },
    }),
  ]);
  res.json({
    departments,
    batches: batches.map((b) => b.batch),
    universityDepartments: universityDepartments.map((u) => u.universityDepartment).filter(Boolean),
  });
}

export async function getStudent(req: AuthRequest, res: Response) {
  const student = await prisma.student.findFirstOrThrow({
    where: { id: req.params.id, ...studentScope(req.user!) },
    include: {
      memberships: { include: { department: true } },
      attendances: { orderBy: { date: "desc" }, take: 100, include: { department: true } },
    },
  });
  const total = student.attendances.length;
  const present = student.attendances.filter((a) => a.status !== "ABSENT").length;
  res.json({
    ...student,
    departments: student.memberships.map((m) => m.department),
    stats: { total, present, percentage: total ? (present / total) * 100 : 0 },
  });
}

/**
 * Create a student, or — if a student with this phone already exists — attach
 * a new department membership to that existing student instead of creating a
 * duplicate row. This is the enforcement point for "one Student row per person".
 */
export async function createStudent(req: AuthRequest, res: Response) {
  const data = studentSchema.parse(req.body);
  const isAdmin = req.user!.role === "SUPER_ADMIN";

  // A leader can only ever attach THEIR OWN department to a student —
  // never register someone directly into another department.
  const departmentIds = isAdmin ? data.departmentIds : [req.user!.departmentId!];
  if (!isAdmin && !data.departmentIds.includes(req.user!.departmentId!)) {
    return res.status(403).json({ message: "You can only add students to your own department" });
  }

  const existing = await prisma.student.findUnique({
    where: { phone: data.phone },
    include: { memberships: true },
  });

  if (existing) {
    // Student already exists (matched by phone) — link the extra department(s)
    // instead of duplicating their record. Ignore departments they're already in.
    const newIds = departmentIds.filter((id) => !existing.memberships.some((m) => m.departmentId === id));
    if (newIds.length === 0) {
      return res.status(409).json({ message: "This student is already registered in that department" });
    }
    await prisma.studentDepartment.createMany({
      data: newIds.map((departmentId) => ({ studentId: existing.id, departmentId })),
    });
    const student = await prisma.student.findUniqueOrThrow({
      where: { id: existing.id },
      include: { memberships: { include: { department: true } } },
    });
    return res.status(200).json({
      message: "Existing student found by phone number — added to the new department instead of duplicating them",
      ...student,
      departments: student.memberships.map((m) => m.department),
    });
  }

  const count = await prisma.student.count();
  const student = await prisma.student.create({
    data: {
      fullName: data.fullName,
      phone: data.phone,
      universityDepartment: data.universityDepartment || null,
      batch: data.batch,
      gender: data.gender,
      status: data.status,
      studentId: formatStudentId(count + 1),
      memberships: { create: departmentIds.map((departmentId) => ({ departmentId })) },
    },
    include: { memberships: { include: { department: true } } },
  });
  res.status(201).json({ ...student, departments: student.memberships.map((m) => m.department) });
}

/**
 * Update a student's shared profile fields (name, phone, batch, etc.).
 * Department membership is NOT changed here — see addMembership/removeMembership.
 * A leader can edit shared fields as long as the student has a membership in
 * their department (findFirstOrThrow + studentScope enforces that).
 */
export async function updateStudent(req: AuthRequest, res: Response) {
  const data = studentUpdateSchema.parse(req.body);
  await prisma.student.findFirstOrThrow({ where: { id: req.params.id, ...studentScope(req.user!) } });
  const { departmentIds, ...rest } = data;
  const student = await prisma.student.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      ...(data.universityDepartment !== undefined
        ? { universityDepartment: data.universityDepartment || null }
        : {}),
    },
    include: { memberships: { include: { department: true } } },
  });
  res.json({ ...student, departments: student.memberships.map((m) => m.department) });
}

/**
 * Attach a department membership to an existing student.
 * A leader may only attach their own department. Admin may attach any department.
 */
export async function addMembership(req: AuthRequest, res: Response) {
  const isAdmin = req.user!.role === "SUPER_ADMIN";
  const targetDepartmentId = isAdmin ? String(req.body?.departmentId ?? "") : req.user!.departmentId!;
  if (!targetDepartmentId) return res.status(400).json({ message: "departmentId is required" });

  // Any caller who can already see this student (i.e. shares at least one
  // department with them, or is admin) may propose adding a new membership —
  // but a leader can still only add THEIR OWN department, checked above.
  await prisma.student.findFirstOrThrow({ where: { id: req.params.id, ...studentScope(req.user!) } });

  await prisma.studentDepartment.upsert({
    where: { studentId_departmentId: { studentId: req.params.id, departmentId: targetDepartmentId } },
    update: {},
    create: { studentId: req.params.id, departmentId: targetDepartmentId },
  });

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: req.params.id },
    include: { memberships: { include: { department: true } } },
  });
  res.json({ ...student, departments: student.memberships.map((m) => m.department) });
}

/**
 * Remove a department membership from a student.
 * A leader may only remove THEIR OWN department's membership — never another
 * department's (e.g. a Mezmur leader can't remove a student's Siel membership).
 * If this was the student's last membership, the whole Student row is deleted
 * (an orphaned student with zero departments shouldn't exist).
 */
export async function removeMembership(req: AuthRequest, res: Response) {
  const isAdmin = req.user!.role === "SUPER_ADMIN";
  const targetDepartmentId = isAdmin ? req.params.departmentId : req.user!.departmentId!;

  const student = await prisma.student.findFirstOrThrow({
    where: { id: req.params.id, ...studentScope(req.user!) },
    include: { memberships: true },
  });

  if (!isAdmin && targetDepartmentId !== req.params.departmentId) {
    return res.status(403).json({ message: "You can only remove your own department's membership" });
  }
  if (!ownsStudentMembership(req.user!, student.memberships) && !isAdmin) {
    return res.status(403).json({ message: "You don't have permission to modify this student" });
  }

  await prisma.studentDepartment.delete({
    where: { studentId_departmentId: { studentId: student.id, departmentId: targetDepartmentId! } },
  });

  const remaining = student.memberships.length - 1;
  if (remaining <= 0) {
    await prisma.student.delete({ where: { id: student.id } });
    return res.json({ message: "Student removed (had no remaining department memberships)" });
  }
  res.json({ message: "Membership removed" });
}

/**
 * Delete a student outright.
 * SUPER_ADMIN only — removes the student and ALL their department
 * memberships and attendance history. Leaders should use removeMembership
 * instead, which only affects their own department.
 */
export async function deleteStudent(req: AuthRequest, res: Response) {
  if (req.user!.role !== "SUPER_ADMIN") {
    return res.status(403).json({
      message: "Leaders can't delete a student outright — use 'Remove from my department' instead",
    });
  }
  await prisma.student.findFirstOrThrow({ where: { id: req.params.id } });
  await prisma.student.delete({ where: { id: req.params.id } });
  res.json({ message: "Student deleted" });
}

/** Bulk import used by Settings > Import data — all imported students land in the caller's department. */
export async function importStudents(req: AuthRequest, res: Response) {
  const rows = Array.isArray(req.body?.students) ? req.body.students : [];
  const isAdmin = req.user!.role === "SUPER_ADMIN";
  const fallbackDepartmentIds = req.user!.departmentId ? [req.user!.departmentId] : [];
  let created = 0;
  let linked = 0;
  let skipped = 0;
  let count = await prisma.student.count();
  for (const row of rows) {
    const departmentIds = Array.isArray(row.departmentIds) && row.departmentIds.length
      ? row.departmentIds
      : fallbackDepartmentIds;
    const parsed = studentSchema.safeParse({ ...row, departmentIds });
    if (!parsed.success || departmentIds.length === 0) { skipped++; continue; }
    // Leaders importing can only ever land students in their own department.
    const finalDepartmentIds = isAdmin ? parsed.data.departmentIds : [req.user!.departmentId!];

    const existing = await prisma.student.findUnique({ where: { phone: parsed.data.phone }, include: { memberships: true } });
    if (existing) {
      const newIds = finalDepartmentIds.filter((id) => !existing.memberships.some((m) => m.departmentId === id));
      if (newIds.length === 0) { skipped++; continue; }
      await prisma.studentDepartment.createMany({ data: newIds.map((departmentId) => ({ studentId: existing.id, departmentId })) });
      linked++;
      continue;
    }

    count++;
    await prisma.student.create({
      data: {
        fullName: parsed.data.fullName,
        phone: parsed.data.phone,
        universityDepartment: parsed.data.universityDepartment || null,
        batch: parsed.data.batch,
        gender: parsed.data.gender,
        status: parsed.data.status,
        studentId: formatStudentId(count),
        memberships: { create: finalDepartmentIds.map((departmentId) => ({ departmentId })) },
      },
    });
    created++;
  }
  res.json({ created, linked, skipped });
}
