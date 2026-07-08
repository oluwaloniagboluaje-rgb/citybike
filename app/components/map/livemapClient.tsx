"use client";

import dynamic from "next/dynamic";

const LiveMap = dynamic(() => import("./livemap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 w-full items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-500">
      Loading map...
    </div>
  ),
});

export default LiveMap;