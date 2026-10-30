"use client";

// Adda — personal WhatsApp-style chat app. Single visible route.

import { useCallback, useSyncExternalStore } from "react";
import { ThemeProvider } from "next-themes";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AuthScreen } from "@/components/chat/auth-screen";
import { ChatApp } from "@/components/chat/chat-app";
import {
  clearAuth,
  getAuthSnapshot,
  getServerAuthSnapshot,
  setAuth,
  subscribeAuth,
} from "@/lib/chat-api";
import { useChatStore } from "@/lib/chat-store";
import { useHydrated } from "@/hooks/use-hydrated";
import type { Me } from "@/lib/chat-types";

export default function Home() {
  const hydrated = useHydrated();
  const auth = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerAuthSnapshot);

  const handleAuthed = useCallback((token: string, me: Me) => {
    setAuth(token, me);
  }, []);

  const handleLogout = useCallback(() => {
    clearAuth();
    useChatStore.getState().reset();
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f0f2f5] dark:bg-[#0b141a]">
        <Loader2 className="h-7 w-7 animate-spin text-[#00a884]" aria-hidden="true" />
        <span className="sr-only">Loading Adda…</span>
      </div>
    );
  }

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {auth ? (
        <ChatApp
          key={auth.token}
          token={auth.token}
          me={auth.me}
          onUnauthorized={handleLogout}
        />
      ) : (
        <AuthScreen onAuthed={handleAuthed} />
      )}
      <Toaster position="top-center" closeButton />
    </ThemeProvider>
  );
}
