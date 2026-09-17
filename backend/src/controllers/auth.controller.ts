import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { changePasswordSchema, loginSchema } from "../utils/validation";
import type { AuthRequest } from "../middleware/auth";

function sign(user: { id: string; role: string; departmentId: string | null }) {
  return jwt.sign(
    { sub: user.id, role: user.role, departmentId: user.departmentId },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" } as jwt.SignOptions,
  );
}

function publicUser(user: {
  id: string; username: string; fullName: string; email: string | null;
  role: string; departmentId: string | null; department?: { name: string } | null;
}) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    departmentName: user.department?.name ?? null,
  };
}

export async function login(req: Request, res: Response) {
  const { username, password } = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { username }, include: { department: true } });
  // Generic message so we never reveal whether the username exists.
  if (!user) return res.status(401).json({ message: "Invalid username or password" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: "Invalid username or password" });
  res.json({ token: sign(user), user: publicUser(user) });
}

export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { department: true } });
  res.json(publicUser(user));
}

export async function updateProfile(req: AuthRequest, res: Response) {
  const { fullName, email, username } = req.body ?? {};
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { fullName, email: email || null, username },
  });
  res.json(publicUser(user));
}

export async function changePassword(req: AuthRequest, res: Response) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) return res.status(400).json({ message: "Current password is incorrect" });
  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(newPassword, 10) },
  });
  res.json({ message: "Password updated" });
}
