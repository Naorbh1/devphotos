"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  senderId: string;
  type: string;
  body: string | null;
  photoId: string | null;
  createdAt: string;
  readAt: string | null;
};

type Props = {
  conversationId: string;
  meId: string;
  otherName: string;
  initialMessages: ChatMessage[];
  readOnly: boolean;
  readOnlyReason: string;
};

const timeFormat = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" });

export default function Chat({
  conversationId,
  meId,
  otherName,
  initialMessages,
  readOnly,
  readOnlyReason,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const markRead = useCallback(() => {
    void fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
  }, [conversationId]);

  // חיבור SSE: הודעות חדשות וסימוני קריאה מגיעים בדחיפה מהשרת
  useEffect(() => {
    const source = new EventSource("/api/stream");

    source.addEventListener("open", () => setConnected(true));

    source.addEventListener("message", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      if (data.conversationId !== conversationId) return;

      setMessages((prev) =>
        prev.some((m) => m.id === data.message.id)
          ? prev
          : [...prev, { ...data.message, readAt: null }],
      );
      if (data.message.senderId !== meId) markRead();
    });

    source.addEventListener("read", (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      if (data.conversationId !== conversationId || data.readerId === meId) return;
      setMessages((prev) =>
        prev.map((m) => (m.senderId === meId && !m.readAt ? { ...m, readAt: data.at } : m)),
      );
    });

    source.addEventListener("error", () => setConnected(false));

    return () => source.close();
  }, [conversationId, meId, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    markRead();
  }, [markRead]);

  async function postMessage(payload: { body?: string; photoId?: string }) {
    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "שליחת ההודעה נכשלה");
      return;
    }
    // ה-SSE עשוי להקדים; מוסיפים רק אם ההודעה עוד לא ברשימה
    setMessages((prev) =>
      prev.some((m) => m.id === data.message.id)
        ? prev
        : [...prev, { ...data.message, readAt: null }],
    );
  }

  async function sendText(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    setText("");
    await postMessage({ body });
    setSending(false);
  }

  async function sendPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSending(true);
    setError(null);

    const form = new FormData();
    form.set("file", file);
    form.set("kind", "MESSAGE");

    const upload = await fetch("/api/photos", { method: "POST", body: form });
    const photo = await upload.json().catch(() => ({}));
    if (fileRef.current) fileRef.current.value = "";

    if (!upload.ok) {
      setError(photo.error || "העלאת התמונה נכשלה");
      setSending(false);
      return;
    }

    await postMessage({ photoId: photo.id });
    setSending(false);
  }

  return (
    <div className="card flex h-[65dvh] flex-col overflow-hidden">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-500">
            זו תחילת השיחה עם {otherName}. תגידו שלום.
          </p>
        )}

        {messages.map((message) => {
          const mine = message.senderId === meId;
          return (
            <div key={message.id} className={mine ? "flex justify-start" : "flex justify-end"}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-[15px] ${
                  mine ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-900"
                }`}
              >
                {message.type === "IMAGE" && message.photoId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/media/${message.photoId}`}
                    alt="תמונה שנשלחה בשיחה"
                    className="mb-1 max-h-72 rounded-xl"
                  />
                )}
                {message.body && <p className="whitespace-pre-wrap break-words">{message.body}</p>}
                <p className={`mt-1 text-[11px] ${mine ? "text-brand-100" : "text-ink-500"}`}>
                  {timeFormat.format(new Date(message.createdAt))}
                  {mine && message.readAt && " · נקרא"}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 pb-1 text-sm text-brand-700">{error}</p>}

      {readOnly ? (
        <p className="border-t border-ink-200 bg-ink-50 p-4 text-center text-sm text-ink-600">
          {readOnlyReason}
        </p>
      ) : (
        <form onSubmit={sendText} className="flex items-center gap-2 border-t border-ink-200 p-3">
          <label className="btn-secondary cursor-pointer px-3" title="שליחת תמונה">
            📷
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={sendPhoto}
              disabled={sending}
            />
          </label>
          <input
            className="field flex-1"
            placeholder={`הודעה ל${otherName}...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            disabled={sending}
          />
          <button type="submit" className="btn-primary" disabled={sending || !text.trim()}>
            שליחה
          </button>
        </form>
      )}

      {!connected && (
        <p className="bg-ink-100 px-4 py-1 text-center text-xs text-ink-500">
          מתחבר לעדכונים בזמן אמת...
        </p>
      )}
    </div>
  );
}
