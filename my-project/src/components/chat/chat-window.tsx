"use client";

// Open conversation: header, message list (with history loading), composer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Ban,
  ChevronDown,
  Loader2,
  Lock,
  Moon,
  MoreVertical,
  Search,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Lightbox } from "@/components/chat/lightbox";
import { MessageBubble } from "@/components/chat/message-bubble";
import { MessageInput } from "@/components/chat/message-input";
import { UserAvatar } from "@/components/chat/user-avatar";
import { useChatSocket } from "@/components/chat/socket-provider";
import { chatApi } from "@/lib/chat-api";
import { useHydrated } from "@/hooks/use-hydrated";
import { formatDayLabel, formatTime12h } from "@/lib/chat-format";
import { computeTickState, useChatStore } from "@/lib/chat-store";
import type { ChatMessage, ConversationSummary, ReplyPreview } from "@/lib/chat-types";

const PAGE_SIZE = 50;

interface ChatWindowProps {
  conversationId: string;
  onBack: () => void;
}

export function ChatWindow({ conversationId, onBack }: ChatWindowProps) {
  const conversation = useChatStore((s) =>
    s.conversations.find((c) => c.id === conversationId)
  );
  const messages = useChatStore((s) => s.messagesByConv[conversationId]);
  const me = useChatStore((s) => s.me);
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const lastSeenByUser = useChatStore((s) => s.lastSeenByUser);
  const failedClientIds = useChatStore((s) => s.failedClientIds);
  // NOTE: selector must return a stable reference (no .filter()/new arrays here —
  // unstable getSnapshot triggers React's infinite-loop guard). Filter in render instead.
  const typingRaw = useChatStore((s) => s.typingByConv[conversationId]);
  const { socket } = useChatSocket();

  const [replyTo, setReplyTo] = useState<ReplyPreview | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const mounted = useHydrated();
  const { resolvedTheme, setTheme } = useTheme();

  // Derived in render (NOT inside a store selector): keeps getSnapshot stable.
  const typingEntries = (typingRaw ?? []).filter(
    (t) => t.isTyping && t.userId !== me?.id
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  const lastCountRef = useRef(0);
  const bubbleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const hasMoreRef = useRef(true);
  const loadingOlderRef = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // ---- Initial load (ChatWindow is keyed by conversationId, so state resets via remount) ----
  useEffect(() => {
    let cancelled = false;
    hasMoreRef.current = true;
    nearBottomRef.current = true;
    lastCountRef.current = 0;
    chatApi
      .messages(conversationId, { limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        useChatStore.getState().setMessages(conversationId, res.messages);
        hasMoreRef.current = res.messages.length >= PAGE_SIZE;
        requestAnimationFrame(() => scrollToBottom("auto"));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load messages");
        }
      })
      .finally(() => {
        if (!cancelled) setInitialLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [conversationId, scrollToBottom]);

  // ---- Read receipts ----
  const messagesLength = messages?.length ?? 0;
  useEffect(() => {
    const markRead = () => {
      if (typeof document !== "undefined" && document.hasFocus()) {
        socket?.emit("read", { conversationId });
        useChatStore.getState().resetUnread(conversationId);
      }
    };
    markRead();
    window.addEventListener("focus", markRead);
    return () => window.removeEventListener("focus", markRead);
  }, [conversationId, socket, messagesLength]);

  // ---- Auto-scroll on new messages ----
  useEffect(() => {
    const prev = lastCountRef.current;
    lastCountRef.current = messagesLength;
    if (messagesLength > prev && messagesLength > 0 && nearBottomRef.current) {
      requestAnimationFrame(() => scrollToBottom(prev === 0 ? "auto" : "smooth"));
    }
  }, [messagesLength, scrollToBottom]);

  // ---- Load older messages ----
  const loadOlder = useCallback(() => {
    const state = useChatStore.getState();
    const list = state.messagesByConv[conversationId];
    if (loadingOlderRef.current || !hasMoreRef.current || !list || list.length === 0) return;
    const oldest = list[0];
    if (!oldest) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    chatApi
      .messages(conversationId, { limit: PAGE_SIZE, before: oldest.createdAt })
      .then((res) => {
        hasMoreRef.current = res.messages.length >= PAGE_SIZE;
        if (res.messages.length > 0) {
          useChatStore.getState().prependMessages(conversationId, res.messages);
          requestAnimationFrame(() => {
            const el2 = scrollRef.current;
            if (el2) el2.scrollTop = el2.scrollHeight - prevHeight + prevTop;
          });
        }
      })
      .catch(() => toast.error("Could not load older messages"))
      .finally(() => {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      });
  }, [conversationId]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = distanceFromBottom < 150;
    setShowJump(!nearBottomRef.current);
    if (el.scrollTop < 80) loadOlder();
  };

  // ---- Actions ----
  const handleQuoteClick = (messageId: string) => {
    const el = bubbleRefs.current.get(messageId);
    if (!el) {
      toast.info("Original message is not loaded");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(messageId);
    window.setTimeout(() => {
      setFlashId((cur) => (cur === messageId ? null : cur));
    }, 1200);
  };

  const registerRef = useCallback((messageId: string, el: HTMLDivElement | null) => {
    if (el) bubbleRefs.current.set(messageId, el);
    else bubbleRefs.current.delete(messageId);
  }, []);

  const handleReply = (message: ChatMessage) => {
    setReplyTo({
      id: message.id,
      content: message.content,
      type: message.type,
      senderId: message.senderId,
      senderName: message.sender.displayName,
    });
  };

  const handleDelete = (message: ChatMessage) => {
    if (!socket || message.pending) return;
    socket.emit(
      "message:delete",
      { messageId: message.id },
      (ack: { ok?: boolean; error?: string }) => {
        if (ack?.ok) {
          useChatStore
            .getState()
            .markMessageDeleted(conversationId, message.id, new Date().toISOString());
          toast.success("Message deleted");
        } else {
          toast.error(ack?.error || "Could not delete message");
        }
      }
    );
  };

  const handleDeleteChat = () => {
    useChatStore.getState().removeConversation(conversationId);
    onBack();
    toast("Chat removed from your list");
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (!conversation || !me) {
    return (
      <div className="flex h-full items-center justify-center bg-[#efeae2] dark:bg-[#0b141a]">
        <Loader2 className="h-6 w-6 animate-spin text-[#00a884]" aria-hidden="true" />
      </div>
    );
  }

  const isGroup = conversation.isGroup;
  const other = conversation.otherUser;
  const displayName = isGroup ? conversation.name ?? "Group" : other?.displayName ?? "Unknown";
  const otherTyping = !isGroup && typingEntries.length > 0;
  const otherOnline = !isGroup && other != null && onlineUserIds.has(other.id);
  const lastSeen = other ? lastSeenByUser[other.id] : undefined;

  const statusLine = isGroup ? (
    <span className="truncate">
      {conversation.participants
        .map((p) => (p.userId === me.id ? "You" : p.user.displayName))
        .join(", ")}
    </span>
  ) : otherTyping ? (
    <span className="inline-flex items-center gap-1 text-[#b8f7cd]">
      typing
      <span aria-hidden="true">
        <span className="adda-typing-dot">.</span>
        <span className="adda-typing-dot">.</span>
        <span className="adda-typing-dot">.</span>
      </span>
    </span>
  ) : otherOnline ? (
    <span className="text-[#b8f7cd]">online</span>
  ) : lastSeen ? (
    <span>last seen at {formatTime12h(lastSeen)}</span>
  ) : (
    <span>offline</span>
  );

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-2 bg-[#008069] px-2 text-white sm:px-4 dark:bg-[#202c33]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chats"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-white/10 md:hidden"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        {isGroup ? (
          <UserAvatar name={displayName} isGroup size={40} />
        ) : (
          <UserAvatar
            name={displayName}
            color={other?.avatarColor}
            size={40}
            online={otherOnline}
          />
        )}

        <button
          type="button"
          onClick={() => toast.info("Conversation info is coming soon")}
          className="min-w-0 flex-1 cursor-pointer rounded px-1 text-left focus-visible:outline-none"
        >
          <p className="truncate text-base font-medium leading-5 text-white">{displayName}</p>
          <p className="h-4 truncate text-xs text-white/80">{statusLine}</p>
        </button>

        <HeaderIcon
          label="Search messages"
          onClick={() => toast.info("Search is coming soon")}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </HeaderIcon>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Menu"
              className="h-10 w-10 cursor-pointer rounded-full text-white/90 hover:bg-white/10 hover:text-white"
            >
              <MoreVertical className="h-5 w-5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-50">
            <DropdownMenuItem onSelect={() => toast.info("Conversation info is coming soon")}>
              Conversation info
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleDeleteChat}>Delete chat</DropdownMenuItem>
            <DropdownMenuItem onSelect={toggleTheme}>
              {mounted && resolvedTheme === "dark" ? (
                <Sun aria-hidden="true" />
              ) : (
                <Moon aria-hidden="true" />
              )}
              {mounted && resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.info("Contact info is coming soon")}>
              Contact info
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Messages */}
      <div className="adda-chat-pattern relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="adda-scroll absolute inset-0 overflow-y-auto py-3"
          role="log"
          aria-label={`Messages in ${displayName}`}
        >
          {/* Encryption notice */}
          <div className="flex justify-center px-4 pb-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-[#ffeecd] px-3 py-1.5 text-center text-[12.5px] text-[#54656f] dark:bg-[#182229] dark:text-[#ffd279]">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Messages are personal and stored on your own server
            </div>
          </div>

          {initialLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#00a884]" aria-hidden="true" />
            </div>
          ) : (
            <div className="flex flex-col gap-[2px]">
              {loadingOlder && (
                <div className="flex justify-center py-2" aria-live="polite">
                  <Loader2 className="h-4 w-4 animate-spin text-[#00a884]" aria-hidden="true" />
                </div>
              )}
              <MessageList
                messages={messages ?? []}
                conversation={conversation}
                meId={me.id}
                onlineUserIds={onlineUserIds}
                failedClientIds={failedClientIds}
                flashId={flashId}
                onReply={handleReply}
                onDelete={handleDelete}
                onImageClick={setLightboxSrc}
                onQuoteClick={handleQuoteClick}
                registerRef={registerRef}
              />
            </div>
          )}
        </div>

        {/* Jump to bottom */}
        <AnimatePresence>
          {showJump && !initialLoading && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute right-4 bottom-4 flex flex-col items-center gap-1.5"
            >
              {conversation.unreadCount > 0 && (
                <span className="rounded-full bg-[#25d366] px-2 py-0.5 text-xs font-semibold text-white">
                  {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                </span>
              )}
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                aria-label="Scroll to latest messages"
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white text-[#54656f] shadow-lg transition-colors hover:bg-[#f0f2f5] dark:bg-[#233138] dark:text-[#8696a0] dark:hover:bg-[#2a3942]"
              >
                <ChevronDown className="h-5 w-5" aria-hidden="true" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Composer */}
      <MessageInput
        conversationId={conversationId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      <Lightbox
        src={lightboxSrc}
        alt="Shared image"
        onClose={() => setLightboxSrc(null)}
      />
    </div>
  );
}

// ---- Message list ----

function MessageList({
  messages,
  conversation,
  meId,
  onlineUserIds,
  failedClientIds,
  flashId,
  onReply,
  onDelete,
  onImageClick,
  onQuoteClick,
  registerRef,
}: {
  messages: ChatMessage[];
  conversation: ConversationSummary;
  meId: string;
  onlineUserIds: Set<string>;
  failedClientIds: Set<string>;
  flashId: string | null;
  onReply: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage) => void;
  onImageClick: (url: string) => void;
  onQuoteClick: (messageId: string) => void;
  registerRef: (messageId: string, el: HTMLDivElement | null) => void;
}) {
  const nodes = useMemo(() => {
    const out: React.ReactNode[] = [];
    let lastDay = "";
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      const day = formatDayLabel(message.createdAt);
      if (day && day !== lastDay) {
        out.push(<DateChip key={`day-${message.id}-${i}`} label={day} />);
        lastDay = day;
      }
      if (message.type === "SYSTEM") {
        out.push(<SystemChip key={message.id} content={message.content} />);
        continue;
      }
      const isOwn = message.senderId === meId;
      const tickState = isOwn
        ? computeTickState(message, conversation, meId, onlineUserIds, failedClientIds)
        : null;
      out.push(
        <MessageBubble
          key={message.id}
          message={message}
          isOwn={isOwn}
          isGroup={conversation.isGroup}
          meId={meId}
          tickState={tickState}
          onReply={() => onReply(message)}
          onDelete={() => onDelete(message)}
          onImageClick={onImageClick}
          onQuoteClick={onQuoteClick}
          flash={flashId === message.id}
          registerRef={registerRef}
        />
      );
    }
    return out;
  }, [
    messages,
    conversation,
    meId,
    onlineUserIds,
    failedClientIds,
    flashId,
    onReply,
    onDelete,
    onImageClick,
    onQuoteClick,
    registerRef,
  ]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
        <Ban className="h-5 w-5 text-[#8696a0]" aria-hidden="true" />
        <p className="text-sm text-[#667781] dark:text-[#8696a0]">No messages yet</p>
        <p className="text-xs text-[#8696a0]">Say hello to get the adda started!</p>
      </div>
    );
  }

  return <>{nodes}</>;
}

function DateChip({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="rounded-lg bg-[#f0f2f5] px-3 py-1 text-[11.5px] font-medium tracking-wide text-[#54656f] uppercase shadow-sm dark:bg-[#182229] dark:text-[#8696a0]">
        {label}
      </span>
    </div>
  );
}

function SystemChip({ content }: { content: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="max-w-[80%] rounded-lg bg-[#ffeecd] px-3 py-1 text-center text-[12.5px] text-[#54656f] dark:bg-[#182229] dark:text-[#ffd279]">
        {content}
      </span>
    </div>
  );
}

function HeaderIcon({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      className="h-10 w-10 cursor-pointer rounded-full text-white/90 hover:bg-white/10 hover:text-white"
    >
      {children}
    </Button>
  );
}
