"use client";

import { useState } from "react";

export default function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex gap-2">
      <input className="field flex-1 font-mono text-sm" value={value} readOnly dir="ltr" />
      <button type="button" className="btn-secondary" onClick={copy}>
        {copied ? "הועתק ✓" : "העתקה"}
      </button>
    </div>
  );
}
