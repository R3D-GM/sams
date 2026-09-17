import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: "Route not found" });
}

// Central error handler: converts Zod and Prisma errors into clean API responses.
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      message: "Validation failed",
      errors: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  if (err?.code === "P2002") {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "field";
    return res.status(409).json({ message: `A record with this ${target} already exists` });
  }
  if (err?.code === "P2025") return res.status(404).json({ message: "Record not found" });
  console.error(err);
  res.status(err?.status ?? 500).json({ message: err?.message ?? "Internal server error" });
}
