import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  role: Role;
  departmentId: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/** Verifies the Bearer JWT and attaches the caller's identity to the request. */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return res.status(401).json({ message: "Not authenticated" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as {
      sub: string;
      role: Role;
      departmentId: string | null;
    };
    req.user = { id: payload.sub, role: payload.role, departmentId: payload.departmentId };
    next();
  } catch {
    return res.status(401).json({ message: "Session expired, please log in again" });
  }
}

/** Restricts a route to specific roles. Always use after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "You don't have permission to do this" });
    }
    next();
  };
}
