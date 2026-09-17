import type { Response } from "express";
import { prisma } from "../lib/prisma";
import { studentSchema, studentUpdateSchema } from "../utils/validation";
import { formatStudentId } from "../utils/helpers";
import { departmentScope } from "../utils/authz";
import type { AuthRequest } from "../middleware/auth";

/** List students with search, filters and pagination — scoped to the caller's department. */
export async function listStudents(req: AuthRequest, res: Response) {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 10)));
  const search = String(req.query.search ?? "").trim();
  const departmentId = String(req.query.departmentId ?? "");
  const batch = String(req.query.batch ?? "");
  const status = String(req.query.status ?? "");
  const universityDepartment = String(req.query.universityDepartment ?? "");

  const where: any = { AND: [departmentScope(req.user!)] as any[] };
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
  if (departmentId) where.AND.push({ departmentId });
  if (batch) where.AND.push({ batch });
  if (status) where.AND.push({ status });
  if (universityDepartment) where.AND.push({ universityDepartment });

  const [items, total] = await Promise.all([
    prisma.student.findMany({
      where,
      include: { department: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.student.count({ where }),
  ]);

  res.json({ items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) });
}

/** Departments in scope, and distinct batches, used to populate filter dropdowns. */
export async function studentFacets(req: AuthRequest, res: Response) {
  const scope = departmentScope(req.user!);
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
    where: { id: req.params.id, ...departmentScope(req.user!) },
    include: { department: true, attendances: { orderBy: { date: "desc" }, take: 100 } },
  });
  const total = student.attendances.length;
  const present = student.attendances.filter((a) => a.status !== "ABSENT").length;
  res.json({ ...student, stats: { total, present, percentage: total ? (present / total) * 100 : 0 } });
}

export async function createStudent(req: AuthRequest, res: Response) {
  const data = studentSchema.parse(req.body);
  // A teacher can only create students in their own department.
  if (req.user!.role !== "SUPER_ADMIN" && data.departmentId !== req.user!.departmentId) {
    return res.status(403).json({ message: "You can only add students to your own department" });
  }
  const count = await prisma.student.count();
  const student = await prisma.student.create({
    data: {
      ...data,
      email: data.email || null,
      universityDepartment: data.universityDepartment || null,
      studentId: formatStudentId(count + 1),
    },
  });
  res.status(201).json(student);
}

export async function updateStudent(req: AuthRequest, res: Response) {
  const data = studentUpdateSchema.parse(req.body);
  // findFirstOrThrow with the scope filter guarantees a teacher can't touch another department's student.
  await prisma.student.findFirstOrThrow({ where: { id: req.params.id, ...departmentScope(req.user!) } });
  const student = await prisma.student.update({
    where: { id: req.params.id },
    data: {
      ...data,
      email: data.email ? data.email : null,
      ...(data.universityDepartment !== undefined
        ? { universityDepartment: data.universityDepartment || null }
        : {}),
    },
  });
  res.json(student);
}

export async function deleteStudent(req: AuthRequest, res: Response) {
  await prisma.student.findFirstOrThrow({ where: { id: req.params.id, ...departmentScope(req.user!) } });
  await prisma.student.delete({ where: { id: req.params.id } });
  res.json({ message: "Student deleted" });
}

/** Bulk import used by Settings > Import data — all imported students land in the caller's department. */
export async function importStudents(req: AuthRequest, res: Response) {
  const rows = Array.isArray(req.body?.students) ? req.body.students : [];
  const fallbackDepartmentId = req.user!.departmentId;
  let created = 0;
  let skipped = 0;
  let count = await prisma.student.count();
  for (const row of rows) {
    const parsed = studentSchema.safeParse({ ...row, departmentId: row.departmentId ?? fallbackDepartmentId });
    if (!parsed.success) { skipped++; continue; }
    const exists = await prisma.student.findUnique({ where: { phone: parsed.data.phone } });
    if (exists) { skipped++; continue; }
    count++;
    await prisma.student.create({
      data: { ...parsed.data, email: parsed.data.email || null, studentId: formatStudentId(count) },
    });
    created++;
  }
  res.json({ created, skipped });
}
