"use client";

// Conversation list sidebar (WhatsApp Web style).

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  Ban,
  Camera,
  Check,
  CheckCheck,
  LogOut,
  MessageSquarePlus,
  Mic,
  Moon,
  Search,
  Sun,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NewChatDialog } from "@/components/chat/new-chat-dialog";
import { ProfileDialog } from "@/components/chat/profile-dialog";
import { UserAvatar } from "@/components/chat/user-avatar";
import { clearAuth } from "@/lib/chat-api";
import { formatConversationTime } from "@/lib/chat-format";
import { useChatStore } from "@/lib/chat-store";
import type { ConversationSummary, LastMessagePreview } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onLogout: () => void;
}

export function Sidebar({ onLogout }: SidebarProps) {
  const me = useChatStore((s) => s.me);
  const conversations = useChatStore((s) => s.conversations);
  const loadingConversations = useChatStore((s) => s.loadingConversations);
  const activeConvId = useChatStore((s) => s.activeConvId);
  const typingByConv = useChatStore((s) => s.typingByConv);
  const onlineUserIds = useChatStore((s) => s.onlineUserIds);
  const setActiveConvId = useChatStore((s) => s.setActiveConvId);

  const [search, setSearch] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = (c.isGroup ? c.name : c.otherUser?.displayName) ?? "";
      const preview = c.lastMessage?.content ?? "";
      return name.toLowerCase().includes(q) || preview.toLowerCase().includes(q);
    });
  }, [conversations, search]);

  const handleLogout = () => {
    clearAuth();
    onLogout();
  };

  return (
    <div className="relative flex h-full w-full flex-col bg-white dark:bg-[#111b21]">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between bg-[#008069] px-3 dark:bg-[#202c33]">
        <h1 className="pl-1 text-lg font-bold text-white">Adda</h1>
        <nav aria-label="Chat actions" className="flex items-center gap-0.5">
          <HeaderIconButton label="New chat" onClick={() => setNewChatOpen(true)}>
            <MessageSquarePlus className="h-5 w-5" />
          </HeaderIconButton>
          <HeaderIconButton label="New group" onClick={() => setNewGroupOpen(true)}>
            <Users className="h-5 w-5" />
          </HeaderIconButton>
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="Open profile"
            className="mx-1 rounded-full transition focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            <UserAvatar name={me?.displayName ?? "Me"} color={me?.avatarColor} size={34} />
          </button>
          <HeaderIconButton label="Log out" onClick={handleLogout}>
            <LogOut className="h-5 w-5" />
          </HeaderIconButton>
        </nav>
      </header>

      {/* Search */}
      <div className="p-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#667781] dark:text-[#8696a0]"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or start a new chat"
            aria-label="Search conversations"
            className="h-9 rounded-full border-none bg-[#f0f2f5] pl-9 text-sm text-[#111b21] focus-visible:ring-0 dark:bg-[#202c33] dark:text-[#e9edef]"
            style={{ boxShadow: "none" }}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div
        className="adda-scroll flex-1 overflow-y-auto"
        role="list"
        aria-label="Conversations"
      >
        {loadingConversations ? (
          <SidebarSkeletons />
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#00a884]/10">
              <MessageSquarePlus className="h-7 w-7 text-[#00a884]" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-[#41525d] dark:text-[#e9edef]">
              No chats yet
            </p>
            <p className="text-xs text-[#667781] dark:text-[#8696a0]">
              Tap the + button to start a conversation
            </p>
          </div>
        ) : (
          filtered.map((conv) => {
            const others = conv.participants.filter((p) => p.userId !== me?.id);
            const anyOtherOnline = others.some((p) => onlineUserIds.has(p.userId));
            return (
              <ConversationRow
                key={conv.id}
                conversation={conv}
                meId={me?.id ?? ""}
                active={conv.id === activeConvId}
                typingNames={(typingByConv[conv.id] ?? [])
                  .filter((t) => t.isTyping && t.userId !== me?.id)
                  .map((t) => t.displayName)}
                anyOtherOnline={anyOtherOnline}
                onlineUserIds={onlineUserIds}
                onOpen={() => setActiveConvId(conv.id)}
              />
            );
          })
        )}
      </div>

      {/* Floating action button */}
      <motion.button
        type="button"
        onClick={() => setNewChatOpen(true)}
        aria-label="Start a new chat"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="absolute right-5 bottom-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#00a884] text-white shadow-lg transition-colors hover:bg-[#017561] focus-visible:ring-2 focus-visible:ring-[#00a884] focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <MessageSquarePlus className="h-6 w-6" aria-hidden="true" />
      </motion.button>

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onConversationOpened={(id) => setActiveConvId(id)}
      />
      <NewChatDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        onConversationOpened={(id) => setActiveConvId(id)}
        initialTab="group"
      />
      <ProfileDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onLogout={handleLogout}
      />
    </div>
  );
}

function HeaderIconButton({
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
      className="h-10 w-10 cursor-pointer rounded-full text-white/90 hover:bg-white/10 hover:text-white focus-visible:ring-white"
    >
      {children}
    </Button>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHydratedClient();
  return (
    <HeaderIconButton
      label={
        mounted && resolvedTheme === "dark"
          ? "Switch to light theme"
          : "Switch to dark theme"
      }
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </HeaderIconButton>
  );
}

const noopSubscribe = () => () => {};
function useHydratedClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

function SidebarSkeletons() {
  return (
    <div aria-hidden="true" className="space-y-1 p-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex h-[72px] items-center gap-3 rounded-lg px-3">
          <Skeleton className="h-12 w-12 rounded-full bg-[#e9edef] dark:bg-[#202c33]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3 bg-[#e9edef] dark:bg-[#202c33]" />
            <Skeleton className="h-3 w-2/3 bg-[#e9edef] dark:bg-[#202c33]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Row ----

function ConversationRow({
  conversation: conv,
  meId,
  active,
  typingNames,
  anyOtherOnline,
  onlineUserIds,
  onOpen,
}: {
  conversation: ConversationSummary;
  meId: string;
  active: boolean;
  typingNames: string[];
  anyOtherOnline: boolean;
  onlineUserIds: Set<string>;
  onOpen: () => void;
}) {
  const name = conv.isGroup
    ? conv.name ?? "Group"
    : conv.otherUser?.displayName ?? "Unknown";
  const color = conv.otherUser?.avatarColor ?? null;
  const last = conv.lastMessage;
  const mine = Boolean(last && last.senderId === meId && meId);
  const time = formatConversationTime(
    last?.createdAt ?? conv.updatedAt
  );
  const unread = conv.unreadCount;
  const typingLabel = typingNames.join(", ");

  return (
    <button
      type="button"
      role="listitem"
      onClick={onOpen}
      aria-label={`Open chat with ${name}`}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex h-[72px] w-full cursor-pointer items-center gap-3 px-3 text-left transition-colors focus-visible:outline-none",
        active
          ? "bg-[#f0f2f5] dark:bg-[#2a3942]"
          : "hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]"
      )}
    >
      <UserAvatar
        name={name}
        color={color}
        isGroup={conv.isGroup}
        size={49}
        online={!conv.isGroup && anyOtherOnline}
      />

      <div className="min-w-0 flex-1 border-b border-[#f0f2f5] py-3 dark:border-[#222d34]">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-medium text-[#111b21] dark:text-[#e9edef]">
            {name}
          </span>
          <span
            className={cn(
              "shrink-0 text-[11px]",
              unread > 0
                ? "font-semibold text-[#00a884] dark:text-[#25d366]"
                : "text-[#667781] dark:text-[#8696a0]"
            )}
          >
            {time}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <div className="min-w-0 flex-1 truncate text-[13.5px] text-[#667781] dark:text-[#8696a0]">
            {typingLabel ? (
              <span className="inline-flex items-center gap-1 text-[#00a884] dark:text-[#25d366]">
                {typingLabel} is typing
                <span aria-hidden="true">
                  <span className="adda-typing-dot">.</span>
                  <span className="adda-typing-dot">.</span>
                  <span className="adda-typing-dot">.</span>
                </span>
              </span>
            ) : (
              <PreviewLine
                last={last}
                mine={mine}
                conv={conv}
                meId={meId}
                onlineUserIds={onlineUserIds}
                bold={unread > 0}
              />
            )}
          </div>
          {unread > 0 && (
            <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-semibold text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function PreviewLine({
  last,
  mine,
  conv,
  meId,
  onlineUserIds,
  bold,
}: {
  last: LastMessagePreview | null;
  mine: boolean;
  conv: ConversationSummary;
  meId: string;
  onlineUserIds: Set<string>;
  bold: boolean;
}) {
  if (!last) {
    return <span className="italic opacity-70">No messages yet</span>;
  }
  if (last.deletedAt) {
    return (
      <span className="inline-flex items-center gap-1 italic">
        <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Deleted message
      </span>
    );
  }

  const prefixIcon =
    last.type === "IMAGE" ? (
      <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ) : last.type === "AUDIO" ? (
      <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    ) : null;

  const label =
    last.type === "IMAGE"
      ? "Photo"
      : last.type === "AUDIO"
        ? "Voice message"
        : last.content;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        bold && "font-medium text-[#111b21] dark:text-[#e9edef]"
      )}
    >
      {mine && <PreviewTicks last={last} conv={conv} meId={meId} onlineUserIds={onlineUserIds} />}
      {prefixIcon}
      <span className="truncate">{label}</span>
    </span>
  );
}

function PreviewTicks({
  last,
  conv,
  meId,
  onlineUserIds,
}: {
  last: LastMessagePreview;
  conv: ConversationSummary;
  meId: string;
  onlineUserIds: Set<string>;
}) {
  const created = new Date(last.createdAt).getTime();
  const others = conv.participants.filter((p) => p.userId !== meId);
  const allRead =
    others.length > 0 &&
    others.every(
      (p) => new Date(p.lastReadAt).getTime() >= created - 500
    );
  const delivered = others.some((p) => onlineUserIds.has(p.userId));

  if (allRead) {
    return (
      <CheckCheck
        className="h-3.5 w-3.5 shrink-0 text-[#53bdeb]"
        aria-label="Read"
      />
    );
  }
  if (delivered) {
    return (
      <CheckCheck
        className="h-3.5 w-3.5 shrink-0 text-[#667781] dark:text-[#8696a0]"
        aria-label="Delivered"
      />
    );
  }
  return (
    <Check
      className="h-3.5 w-3.5 shrink-0 text-[#667781] dark:text-[#8696a0]"
      aria-label="Sent"
    />
  );
}
