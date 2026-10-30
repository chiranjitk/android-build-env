"use client";

// Returns true once the component has hydrated on the client.
// Uses useSyncExternalStore so there is no setState-in-effect and no
// hydration mismatch (server snapshot is always false).

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
