import { getCurrentUser } from "@/lib/auth";
import { fail, route } from "@/lib/api";
import { subscribe, type ChatEvent } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ערוץ SSE אישי: כל האירועים שנוגעים למשתמש המחובר (הודעות חדשות,
 * סימוני קריאה והתאמות) מגיעים בחיבור אחד שנשאר פתוח.
 */
export const GET = route(async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) return fail(401, "נדרשת התחברות");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          closed = true;
        }
      };

      send(": connected\n\n");

      const unsubscribe = subscribe(user.id, (event: ChatEvent) => {
        send(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      // פינג תקופתי — מונע ניתוק ע"י פרוקסי בדרך
      const ping = setInterval(() => send(": ping\n\n"), 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // הזרם כבר נסגר
        }
      };

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
