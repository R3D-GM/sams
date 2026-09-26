import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { loginLimiter } from "../middleware/rateLimit";
import * as auth from "../controllers/auth.controller";
import * as students from "../controllers/student.controller";
import * as attendance from "../controllers/attendance.controller";
import * as report from "../controllers/report.controller";

const a = (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

export const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

// --- auth ---
router.post("/auth/login", loginLimiter, a(auth.login));
router.get("/auth/me", requireAuth, a(auth.me));
router.patch("/auth/profile", requireAuth, a(auth.updateProfile));
router.post("/auth/change-password", requireAuth, a(auth.changePassword));

// --- students (department-scoped inside these controllers) ---
router.get("/students", requireAuth, a(students.listStudents));
router.get("/students/facets", requireAuth, a(students.studentFacets));
router.get("/students/:id", requireAuth, a(students.getStudent));
router.post("/students", requireAuth, a(students.createStudent));
router.post("/students/import", requireAuth, a(students.importStudents));
router.patch("/students/:id", requireAuth, a(students.updateStudent));
router.delete("/students/:id", requireAuth, a(students.deleteStudent));
// A leader can only add/remove their OWN department's membership (enforced in the controller).
router.post("/students/:id/memberships", requireAuth, a(students.addMembership));
router.delete("/students/:id/memberships/:departmentId", requireAuth, a(students.removeMembership));

// --- attendance (department-scoped inside these controllers) ---
router.get("/attendance/sheet", requireAuth, a(attendance.getSheet));
router.post("/attendance", requireAuth, a(attendance.saveAttendance));
router.get("/attendance/sessions", requireAuth, a(attendance.listSessions));
router.get("/attendance/sessions/:date", requireAuth, a(attendance.getSession));
router.delete("/attendance/sessions/:date", requireAuth, a(attendance.deleteSession));

// --- reports & utilities ---
router.get("/dashboard", requireAuth, a(report.dashboard));
router.get("/reports", requireAuth, a(report.reports));
router.get("/reports/backup", requireAuth, requireRole("SUPER_ADMIN"), a(report.backup));
router.post("/reports/restore", requireAuth, requireRole("SUPER_ADMIN"), a(report.restore));
router.get("/search", requireAuth, a(report.search));
