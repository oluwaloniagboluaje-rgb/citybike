"use client";

import { useState } from "react";
import StatusModal, {
  CLOSED_MODAL,
  type StatusModalState,
} from "@/components/ui/StatusModal";

export default function UnsubscribeForm({ token }: { token: string }) {
  const [status, setStatus] = useState<"ready" | "saving" | "done" | "error">(
    "ready"
  );
  const [modal, setModal] = useState<StatusModalState>(CLOSED_MODAL);

  async function unsubscribe() {
    setStatus("saving");
    try {
      const response = await fetch(
        `/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`,
        { method: "POST" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update your preference.");
      }
      setStatus("done");
      setModal({
        open: true,
        variant: "success",
        title: "Unsubscribed",
        message: "You have been unsubscribed from marketing emails.",
      });
    } catch (error) {
      setStatus("error");
      setModal({
        open: true,
        variant: "error",
        title: "Could not unsubscribe",
        message:
          error instanceof Error
            ? error.message
            : "Could not update your preference. Please try again.",
      });
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-neutral-900">
          Marketing email preferences
        </h1>
        <p className="mt-3 text-neutral-600">
          You can stop promotional emails while continuing to receive important
          account and delivery updates.
        </p>
        {status !== "done" && (
          <button
            type="button"
            onClick={() => void unsubscribe()}
            disabled={status === "saving" || !token}
            className="mt-6 rounded-lg bg-orange-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            {status === "saving" ? "Updating..." : "Unsubscribe"}
          </button>
        )}
      </div>
      <StatusModal state={modal} onClose={() => setModal(CLOSED_MODAL)} />
    </main>
  );
}
