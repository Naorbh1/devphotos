import { NextResponse } from "next/server";
import { recordClick } from "@/lib/affiliate";
import { REFERRAL_COOKIE, REFERRAL_COOKIE_MAX_AGE } from "@/lib/constants";
import { route } from "@/lib/api";

export const runtime = "nodejs";

/**
 * קישור השותף: /r/<code>?to=/search
 * רושם קליק, שומר עוגיית ייחוס ל-30 יום ומפנה לדף הנחיתה.
 */
export const GET = route(async (req: Request, ctx: { params: Promise<{ code: string }> }) => {
  const { code } = await ctx.params;
  const url = new URL(req.url);

  // מונע פתיחת הפניה לאתר חיצוני — רק נתיבים פנימיים
  const to = url.searchParams.get("to") || "/";
  const target = to.startsWith("/") && !to.startsWith("//") ? to : "/";

  const res = NextResponse.redirect(new URL(target, url.origin));

  const clickId = await recordClick({
    code,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
    userAgent: req.headers.get("user-agent") || "",
    landingPath: target,
  });

  if (clickId) {
    const options = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: REFERRAL_COOKIE_MAX_AGE,
    };
    res.cookies.set(REFERRAL_COOKIE, code.toLowerCase(), options);
    res.cookies.set(`${REFERRAL_COOKIE}_click`, clickId, options);
  }

  return res;
});
