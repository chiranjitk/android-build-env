"use client";

// Main app shell: sidebar + chat window, socket wiring, title bar unread counter.

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { ChatWindow } from "@/components/chat/chat-window";
import { Sidebar } from "@/components/chat/sidebar";
import { SocketProvider } from "@/components/chat/socket-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { chatApi } from "@/lib/chat-api";
import { selectTotalUnread, useChatStore } from "@/lib/chat-store";
import type { Me } from "@/lib/chat-types";

interface ChatAppProps {
  token: string;
  me: Me;
  onUnauthorized: () => void;
}

export function ChatApp({ token, me, onUnauthorized }: ChatAppProps) {
  // Seed the store before any child effect runs (socket handler needs `me`).
  useState(() => {
    useChatStore.getState().setMe(me);
  });

  const isMobile = useIsMobile();
  const activeConvId = useChatStore((s) => s.activeConvId);
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;

  const loadConversations = useCallback(async (quiet = false) => {
    try {
      const res = await chatApi.conversations();
      useChatStore.getState().setConversations(res.conversations);
    } catch (err) {
      if (!quiet) {
        toast.error(err instanceof Error ? err.message : "Could not load conversations");
      }
    } finally {
      useChatStore.getState().setLoadingConversations(false);
    }
  }, []);

  // Initial load + cheap 30s poll (order/unread refresh).
  useEffect(() => {
    useChatStore.getState().setLoadingConversations(true);
    // Explicit session verification: a 401 clears credentials and reloads to
    // the login screen (handled centrally in chat-api).
    void chatApi.me().catch(() => {});
    void loadConversations();
    const interval = window.setInterval(() => {
      void loadConversations(true);
    }, 30000);
    return () => window.clearInterval(interval);
  }, [loadConversations]);

  // Document title shows total unread and flashes while the tab is hidden.
  const totalUnread = useChatStore((s) => selectTotalUnread(s));
  useEffect(() => {
    const base = totalUnread > 0 ? `(${totalUnread}) Adda` : "Adda";
    document.title = base;
    if (totalUnread === 0) return;
    let flip = true;
    const interval = window.setInterval(() => {
      flip = !flip;
      document.title = !flip && !document.hasFocus() ? "Adda" : base;
    }, 1200);
    return () => {
      window.clearInterval(interval);
      document.title = "Adda";
    };
  }, [totalUnread]);

  const closeConversation = useCallback(() => {
    useChatStore.getState().setActiveConvId(null);
  }, []);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#d1d7db] dark:bg-[#0b141a]">
      <SocketProvider token={token} onUnauthorized={onUnauthorized}>
        <div className="mx-auto flex h-full w-full max-w-[1600px] overflow-hidden">
          {isMobile ? (
            <AnimatePresence mode="wait" initial={false}>
              {activeConvId ? (
                <motion.div
                  key="chat"
                  initial={{ x: 48, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 48, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="h-full w-full"
                >
                  <ChatWindow
                    key={activeConvId}
                    conversationId={activeConvId}
                    onBack={closeConversation}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ x: -32, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -32, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="h-full w-full"
                >
                  <Sidebar onLogout={onUnauthorized} />
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <>
              <aside className="h-full w-[400px] shrink-0 border-r border-[#e9edef] dark:border-[#222d34]">
                <Sidebar onLogout={onUnauthorized} />
              </aside>
              <section className="h-full min-w-0 flex-1">
                {activeConvId ? (
                  <ChatWindow
                    key={activeConvId}
                    conversationId={activeConvId}
                    onBack={closeConversation}
                  />
                ) : (
                  <EmptyPane />
                )}
              </section>
            </>
          )}
        </div>
      </SocketProvider>
    </div>
  );
}

function EmptyPane() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 border-b-4 border-[#00a884] bg-[#f0f2f5] px-8 text-center dark:bg-[#222e35]">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#00a884]">
        <MessageCircle className="h-8 w-8 text-white" aria-hidden="true" />
      </span>
      <h2 className="text-2xl font-light text-[#41525d] dark:text-[#e9edef]">Adda</h2>
      <p className="max-w-sm text-sm leading-6 text-[#667781] dark:text-[#8696a0]">
        Your personal private chat. Select a conversation on the left — or start
        a new one — and begin the adda.
      </p>
    </div>
  );
}
