import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

/** ממיר חריגות מוכרות לתשובת JSON עקבית */
export function handleError(err: unknown) {
  if (err instanceof HttpError) return fail(err.status, err.message);
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return fail(400, first?.message ?? "קלט לא תקין", {
      fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])),
    });
  }
  console.error("[api]", err);
  return fail(500, "אירעה שגיאה בשרת");
}

/** עוטף handler של route ומטפל בשגיאות במקום אחד */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      return handleError(err);
    }
  };
}

// ------------------------------------------------- הגבלת קצב בסיסית בזיכרון
// מספיקה לפיתוח ולמופע יחיד. בפרודקשן להחליף ל-Redis.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count++;
  if (bucket.count > limit) {
    throw new HttpError(429, "יותר מדי בקשות, נסו שוב בעוד רגע");
  }
}
