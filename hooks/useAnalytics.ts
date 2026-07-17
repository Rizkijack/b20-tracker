"use client";

import { useMemo } from "react";
import type { B20Event, B20Token } from "@/lib/types";
import { computeAnalytics } from "@/lib/analytics";

export function useAnalytics(events: B20Event[], tokens: B20Token[]) {
  const analytics = useMemo(() => computeAnalytics(events, tokens), [events, tokens]);

  return analytics;
}
