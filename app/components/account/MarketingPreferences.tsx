"use client";

import { useEffect, useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import StatusModal, {
  CLOSED_MODAL,
  type StatusModalState,
} from "@/components/ui/StatusModal";

export default function MarketingPreferences() {
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmUnsubscribe, setConfirmUnsubscribe] = useState(false);
  const [modal, setModal] = useState<StatusModalState>(CLOSED_MODAL);

  function showModal(variant: "success" | "error", title: string, message: string) {
    setModal({ open: true, variant, title, message });
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/marketing/preferences")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not load email preferences.");
        }
        return data;
      })
      .then((data) => {
        if (active) setConsent(data.marketingConsent === true);
      })
      .catch((loadError: unknown) => {
        if (active) {
          showModal(
            "error",
            "Could not load preferences",
            loadError instanceof Error
              ? loadError.message
              : "Could not load email preferences."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function updateConsent(nextConsent: boolean) {
    setSaving(true);
    try {
      const response = await fetch("/api/marketing/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingConsent: nextConsent }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update your preference.");
      }
      setConsent(data.marketingConsent === true);
      setConfirmUnsubscribe(false);
      showModal(
        "success",
        "Email preferences updated",
        nextConsent
          ? "You are subscribed to CityBike Logistics marketing emails."
          : "You have been unsubscribed from marketing emails."
      );
    } catch (saveError) {
      showModal(
        "error",
        "Could not update preferences",
        saveError instanceof Error
          ? saveError.message
          : "Could not update your preference."
      );
    } finally {
      setSaving(false);
    }
  }

  function handlePreferenceChange(nextConsent: boolean) {
    if (nextConsent) {
      void updateConsent(true);
    } else {
      setConfirmUnsubscribe(true);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="font-semibold text-neutral-900">Email preferences</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Active customer accounts receive campaigns by default. Turn this off to
        unsubscribe from promotions and announcements; order and account emails
        are not affected.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-neutral-800">
        <input
          type="checkbox"
          checked={consent}
          disabled={loading || saving}
          onChange={(event) => handlePreferenceChange(event.target.checked)}
          className="h-4 w-4 accent-orange-600"
        />
        Receive marketing emails from CityBike Logistics
      </label>
      {loading && <p className="mt-2 text-sm text-neutral-500">Loading preference...</p>}
      {saving && <p className="mt-2 text-sm text-neutral-500">Saving...</p>}
      <ConfirmModal
        open={confirmUnsubscribe}
        title="Unsubscribe from campaigns?"
        message="You will no longer receive marketing campaigns. Important order and account emails will continue."
        confirmLabel="Unsubscribe"
        destructive
        disabled={saving}
        onConfirm={() => void updateConsent(false)}
        onCancel={() => setConfirmUnsubscribe(false)}
      />
      <StatusModal state={modal} onClose={() => setModal(CLOSED_MODAL)} />
    </section>
  );
}
