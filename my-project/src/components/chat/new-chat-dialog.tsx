"use client";

// Start a new 1:1 chat or create a group.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/chat/user-avatar";
import { chatApi } from "@/lib/chat-api";
import { useChatStore } from "@/lib/chat-store";
import type { ChatUser } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationOpened: (conversationId: string) => void;
  initialTab?: "chats" | "group";
}

export function NewChatDialog({
  open,
  onOpenChange,
  onConversationOpened,
  initialTab = "chats",
}: NewChatDialogProps) {
  const [tab, setTab] = useState<"chats" | "group">(initialTab);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setSearch("");
    setGroupName("");
    setSelected(new Set());
    let cancelled = false;
    setLoading(true);
    chatApi
      .users()
      .then((res) => {
        if (!cancelled) setUsers(res.users);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load users");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, initialTab]);

  const onlineUserIds = useChatStore((s) => s.onlineUserIds);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );
  }, [users, search]);

  const startChat = async (user: ChatUser) => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await chatApi.createConversation({
        isGroup: false,
        memberIds: [user.id],
      });
      await refreshConversations();
      onOpenChange(false);
      onConversationOpened(res.conversation.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start chat");
    } finally {
      setCreating(false);
    }
  };

  const refreshConversations = async () => {
    try {
      const list = await chatApi.conversations();
      useChatStore.getState().setConversations(list.conversations);
    } catch {
      // The polling refresh will pick it up.
    }
  };

  const toggleMember = (userId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  const createGroup = async () => {
    if (creating) return;
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    if (selected.size < 1) {
      toast.error("Select at least one member");
      return;
    }
    setCreating(true);
    try {
      const res = await chatApi.createConversation({
        isGroup: true,
        name: groupName.trim(),
        memberIds: [...selected],
      });
      toast.success(`Group "${groupName.trim()}" created`);
      await refreshConversations();
      onOpenChange(false);
      onConversationOpened(res.conversation.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden bg-white p-0 sm:max-w-md dark:bg-[#111b21]">
        <DialogHeader className="bg-[#008069] px-6 py-4 dark:bg-[#202c33]">
          <DialogTitle className="text-white">New conversation</DialogTitle>
          <DialogDescription className="text-white/80">
            Chat privately or create a group
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v === "group" ? "group" : "chats")}
          className="flex max-h-[60vh] flex-col"
        >
          <TabsList className="mx-4 mt-3 grid grid-cols-2">
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="group">New Group</TabsTrigger>
          </TabsList>

          <TabsContent value="chats" className="mt-3 flex min-h-0 flex-1 flex-col px-4 pb-4">
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#667781] dark:text-[#8696a0]"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or username"
                aria-label="Search users"
                className="h-9 rounded-full border-none bg-[#f0f2f5] pl-9 text-sm dark:bg-[#202c33]"
              />
            </div>
            <UserList
              loading={loading}
              users={filtered}
              renderTrailing={() => null}
              onPick={(user) => void startChat(user)}
              onlineUserIds={onlineUserIds}
              showOnlineDot
            />
          </TabsContent>

          <TabsContent value="group" className="mt-3 flex min-h-0 flex-1 flex-col px-4 pb-4">
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              aria-label="Group name"
              maxLength={50}
              className="mb-3 h-10 text-sm"
            />
            <p className="mb-1.5 text-xs font-medium text-[#667781] dark:text-[#8696a0]">
              Add members ({selected.size} selected)
            </p>
            <UserList
              loading={loading}
              users={filtered}
              renderTrailing={(user) => (
                <Checkbox
                  checked={selected.has(user.id)}
                  onCheckedChange={(checked) => toggleMember(user.id, checked === true)}
                  aria-label={`Add ${user.displayName} to group`}
                  onClick={(e) => e.stopPropagation()}
                  className="data-[state=checked]:border-[#00a884] data-[state=checked]:bg-[#00a884]"
                />
              )}
              onPick={(user) => toggleMember(user.id, !selected.has(user.id))}
              onlineUserIds={onlineUserIds}
            />
            <Button
              onClick={() => void createGroup()}
              disabled={creating || !groupName.trim() || selected.size < 1}
              className="mt-3 h-10 w-full cursor-pointer bg-[#00a884] text-white hover:bg-[#017561] disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Users className="h-4 w-4" aria-hidden="true" />
              )}
              Create Group
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function UserList({
  loading,
  users,
  renderTrailing,
  onPick,
  onlineUserIds,
  showOnlineDot = false,
}: {
  loading: boolean;
  users: ChatUser[];
  renderTrailing: (user: ChatUser) => React.ReactNode;
  onPick: (user: ChatUser) => void;
  onlineUserIds: Set<string>;
  showOnlineDot?: boolean;
}) {
  if (loading) {
    return (
      <div className="adda-scroll min-h-[120px] flex-1 space-y-1 overflow-y-auto pr-1" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
            <Skeleton className="h-10 w-10 rounded-full bg-[#e9edef] dark:bg-[#202c33]" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/3 bg-[#e9edef] dark:bg-[#202c33]" />
              <Skeleton className="h-3 w-1/2 bg-[#e9edef] dark:bg-[#202c33]" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (users.length === 0) {
    return (
      <div className="flex min-h-[120px] flex-1 items-center justify-center text-sm text-[#667781] dark:text-[#8696a0]">
        No users found
      </div>
    );
  }
  return (
    <div className="adda-scroll min-h-[120px] flex-1 overflow-y-auto pr-1">
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          onClick={() => onPick(user)}
          className={cn(
            "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
            "hover:bg-[#f5f6f6] focus-visible:bg-[#f0f2f5] focus-visible:outline-none dark:hover:bg-[#202c33] dark:focus-visible:bg-[#2a3942]"
          )}
        >
          <UserAvatar
            name={user.displayName}
            color={user.avatarColor}
            size={40}
            online={showOnlineDot && onlineUserIds.has(user.id)}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium text-[#111b21] dark:text-[#e9edef]">
              {user.displayName}
            </p>
            <p className="truncate text-xs text-[#667781] dark:text-[#8696a0]">
              {user.about || `@${user.username}`}
            </p>
          </div>
          {renderTrailing(user)}
        </button>
      ))}
    </div>
  );
}
