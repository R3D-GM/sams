import rateLimit from "express-rate-limit";

/**
 * General API-wide limit. Generous enough that normal app usage (dashboard
 * polling, taking attendance, browsing students) never comes close to it —
 * this exists to stop rapid scripted abuse (scraping all student data,
 * hammering the server), not to slow down real users.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please slow down and try again shortly" },
});

/**
 * Strict limit on login attempts specifically, since this is the classic
 * brute-force target (guessing a leader's password). Keyed by IP + the
 * submitted username, so one person mistyping their own password repeatedly
 * doesn't lock out everyone else on the same network/IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.username ?? "").toLowerCase()}`,
  message: { message: "Too many login attempts. Please wait 15 minutes and try again" },
});
