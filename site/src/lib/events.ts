import "server-only";
import { EventEmitter } from "node:events";

/**
 * אפיק אירועים בזיכרון התהליך שמזין את חיבורי ה-SSE של הצ'אט.
 * מספיק למופע שרת יחיד (פיתוח / VPS). לריצה על כמה מופעים —
 * להחליף ל-Redis pub/sub או ל-Postgres LISTEN/NOTIFY (ראה README).
 */

export type ChatEvent =
  | {
      type: "message";
      conversationId: string;
      message: {
        id: string;
        senderId: string;
        type: "TEXT" | "IMAGE";
        body: string | null;
        photoId: string | null;
        createdAt: string;
      };
    }
  | { type: "read"; conversationId: string; readerId: string; at: string }
  | { type: "match"; matchId: string; withUserId: string };

const globalForBus = globalThis as unknown as { chatBus?: EventEmitter };

const bus = globalForBus.chatBus ?? new EventEmitter();
bus.setMaxListeners(0);
globalForBus.chatBus = bus;

/** משדר אירוע לתיבה האישית של כל אחד מהמשתמשים ברשימה */
export function publish(userIds: string[], event: ChatEvent) {
  for (const userId of userIds) bus.emit(`user:${userId}`, event);
}

export function subscribe(userId: string, listener: (event: ChatEvent) => void) {
  const channel = `user:${userId}`;
  bus.on(channel, listener);
  return () => {
    bus.off(channel, listener);
  };
}
