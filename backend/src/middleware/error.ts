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

  // Always log the full error server-side, whether or not it's shown to the client.
  console.error(err);

  const status = err?.status ?? 500;
  // Only forward the real error message for an INTENTIONAL client error (4xx)
  // that some route explicitly threw with that status attached — never for an
  // unexpected/unhandled failure (500), which could otherwise leak internal
  // details (file paths, library names, raw database errors, etc.) to whoever
  // made the request.
  const message = status >= 400 && status < 500 && err?.message ? err.message : "Internal server error";
  res.status(status).json({ message });
}
