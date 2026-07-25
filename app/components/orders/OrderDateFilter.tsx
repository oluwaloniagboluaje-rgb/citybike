"use client";

import { DateFilterValue } from "@/libs/dateGroups";
import { Calendar } from "lucide-react";

export default function OrderDateFilter({
  value,
  onChange,
}: {
  value: DateFilterValue;
  onChange: (v: DateFilterValue) => void;
}) {
  const isCustomDate = value !== "all" && value !== "today" && value !== "yesterday";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button
        onClick={() => onChange("today")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium ${
          value === "today"
            ? "bg-orange-600 text-white"
            : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
        }`}
      >
        Today
      </button>
      <button
        onClick={() => onChange("yesterday")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium ${
          value === "yesterday"
            ? "bg-orange-600 text-white"
            : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
        }`}
      >
        Yesterday
      </button>
      <button
        onClick={() => onChange("all")}
        className={`rounded-md px-3 py-1.5 text-xs font-medium ${
          value === "all"
            ? "bg-orange-600 text-white"
            : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
        }`}
      >
        All
      </button>
      <label className="flex items-center gap-1.5 rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700">
        <Calendar className="h-3.5 w-3.5" />
        <input
          type="date"
          value={isCustomDate ? value : ""}
          onChange={(e) => onChange(e.target.value || "all")}
          className="bg-transparent outline-none"
        />
      </label>
    </div>
  );
}