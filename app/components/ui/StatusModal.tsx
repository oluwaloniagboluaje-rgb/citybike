"use client";

import { CheckCircle2, XCircle } from "lucide-react";

export interface StatusModalState {
  open: boolean;
  variant: "success" | "error";
  title: string;
  message: string;
}

export const CLOSED_MODAL: StatusModalState = {
  open: false,
  variant: "success",
  title: "",
  message: "",
};

export default function StatusModal({
  state,
  onClose,
}: {
  state: StatusModalState;
  onClose: () => void;
}) {
  if (!state.open) return null;

  const isSuccess = state.variant === "success";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 text-center shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto mb-3 inline-flex rounded-full p-2.5 ${
            isSuccess ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
          }`}
        >
          {isSuccess ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
        </div>
        <h2 className="text-base font-semibold text-neutral-900">{state.title}</h2>
        <p className="mt-1 text-sm text-neutral-600">{state.message}</p>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          OK
        </button>
      </div>
    </div>
  );
}