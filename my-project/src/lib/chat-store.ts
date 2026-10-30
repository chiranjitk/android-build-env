// Zustand store for the Adda chat app (client state only).

import { create } from "zustand";
import type {
  ChatMessage,
  ConversationSummary,
  LastMessagePreview,
  Me,
} from "@/lib/chat-types";

export interface TypingEntry {
  userId: string;
  displayName: string;
  isTyping: boolean;
  at: number;
}

export type TickState = "pending" | "failed" | "sent" | "delivered" | "read";

function timeOf(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function sortConversations(list: ConversationSummary[]): ConversationSummary[] {
  return [...list].sort(
    (a, b) =>
      timeOf(b.lastMessage?.createdAt ?? b.updatedAt) -
      timeOf(a.lastMessage?.createdAt ?? a.updatedAt)
  );
}

function sortMessages(list: ChatMessage[]): ChatMessage[] {
  return [...list].sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
}

function previewOf(message: ChatMessage): LastMessagePreview {
  return {
    id: message.id,
    content: message.content,
    type: message.type,
    senderId: message.senderId,
    createdAt: message.createdAt,
    deletedAt: message.deletedAt,
  };
}

interface ChatState {
  me: Me | null;
  conversations: ConversationSummary[];
  messagesByConv: Record<string, ChatMessage[]>;
  onlineUserIds: Set<string>;
  lastSeenByUser: Record<string, string>;
  typingByConv: Record<string, TypingEntry[]>;
  failedClientIds: Set<string>;
  activeConvId: string | null;
  loadingConversations: boolean;

  setMe: (me: Me | null) => void;
  setLoadingConversations: (loading: boolean) => void;
  setConversations: (list: ConversationSummary[]) => void;
  removeConversation: (conversationId: string) => void;
  setActiveConvId: (conversationId: string | null) => void;

  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  prependMessages: (conversationId: string, messages: ChatMessage[]) => void;
  applyOptimistic: (conversationId: string, message: ChatMessage) => void;
  appendServerMessage: (conversationId: string, message: ChatMessage, myId: string) => void;
  applyAck: (
    conversationId: string,
    clientId: string,
    message: ChatMessage,
    deliveredOnline: boolean
  ) => void;
  markMessageFailed: (clientId: string) => void;
  markMessageDeleted: (conversationId: string, messageId: string, deletedAt: string) => void;

  incrementUnread: (conversationId: string) => void;
  resetUnread: (conversationId: string) => void;
  markParticipantRead: (conversationId: string, userId: string, lastReadAt: string) => void;

  setPresenceSync: (onlineUserIds: string[]) => void;
  setPresenceOnline: (userId: string) => void;
  setPresenceOffline: (userId: string, lastSeen: string) => void;

  setTyping: (conversationId: string, entry: TypingEntry) => void;
  purgeTyping: () => void;

  reset: () => void;
}

function touchConversation(
  state: ChatState,
  conversationId: string,
  message: ChatMessage | null,
  opts?: { bumpUnread?: boolean; resetUnread?: boolean }
): ConversationSummary[] {
  const existing = state.conversations.find((c) => c.id === conversationId);
  if (!existing) return state.conversations;

  const next: ConversationSummary = {
    ...existing,
    lastMessage: message ? previewOf(message) : existing.lastMessage,
    updatedAt: message ? message.createdAt : existing.updatedAt,
    unreadCount: opts?.resetUnread
      ? 0
      : opts?.bumpUnread
        ? existing.unreadCount + 1
        : existing.unreadCount,
  };

  const rest = state.conversations.filter((c) => c.id !== conversationId);
  return sortConversations([next, ...rest]);
}

export const useChatStore = create<ChatState>()((set) => ({
  me: null,
  conversations: [],
  messagesByConv: {},
  onlineUserIds: new Set<string>(),
  lastSeenByUser: {},
  typingByConv: {},
  failedClientIds: new Set<string>(),
  activeConvId: null,
  loadingConversations: false,

  setMe: (me) => set({ me }),

  setLoadingConversations: (loading) => set({ loadingConversations: loading }),

  setConversations: (list) => set({ conversations: sortConversations(list) }),

  removeConversation: (conversationId) =>
    set((state) => {
      const { [conversationId]: _removed, ...restMessages } = state.messagesByConv;
      return {
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        messagesByConv: restMessages,
        activeConvId: state.activeConvId === conversationId ? null : state.activeConvId,
      };
    }),

  setActiveConvId: (conversationId) =>
    set((state) => {
      if (conversationId == null) return { activeConvId: null };
      // Opening a conversation clears its unread badge.
      const conversations = state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      );
      return { activeConvId: conversationId, conversations };
    }),

  setMessages: (conversationId, messages) =>
    set((state) => {
      const pending = (state.messagesByConv[conversationId] ?? []).filter(
        (m) => m.pending && m.clientId && !messages.some((s) => s.id === m.id || s.clientId === m.clientId)
      );
      const merged = sortMessages([...messages, ...pending]);
      return { messagesByConv: { ...state.messagesByConv, [conversationId]: merged } };
    }),

  prependMessages: (conversationId, messages) =>
    set((state) => {
      const current = state.messagesByConv[conversationId] ?? [];
      const known = new Set(current.map((m) => m.id));
      const fresh = messages.filter((m) => !known.has(m.id));
      if (fresh.length === 0) return state;
      return {
        messagesByConv: {
          ...state.messagesByConv,
          [conversationId]: sortMessages([...fresh, ...current]),
        },
      };
    }),

  applyOptimistic: (conversationId, message) =>
    set((state) => {
      const current = state.messagesByConv[conversationId] ?? [];
      return {
        messagesByConv: {
          ...state.messagesByConv,
          [conversationId]: sortMessages([...current, message]),
        },
        conversations: touchConversation(state, conversationId, message),
      };
    }),

  appendServerMessage: (conversationId, message, myId) =>
    set((state) => {
      const current = state.messagesByConv[conversationId] ?? [];
      if (current.some((m) => m.id === message.id)) return state;

      let nextList: ChatMessage[];
      if (message.senderId === myId) {
        // Own message echoed back by the server: replace a matching pending
        // optimistic bubble instead of appending a duplicate.
        const idx = current.findIndex(
          (m) =>
            m.pending &&
            m.clientId != null &&
            m.senderId === myId &&
            m.type === message.type &&
            m.content === message.content
        );
        if (idx >= 0) {
          nextList = current.slice();
          nextList[idx] = message;
        } else {
          nextList = [...current, message];
        }
      } else {
        nextList = [...current, message];
      }

      const failed = new Set(state.failedClientIds);
      if (message.clientId) failed.delete(message.clientId);

      return {
        messagesByConv: {
          ...state.messagesByConv,
          [conversationId]: sortMessages(nextList),
        },
        conversations: touchConversation(state, conversationId, message),
        failedClientIds: failed,
      };
    }),

  applyAck: (conversationId, clientId, message, deliveredOnline) =>
    set((state) => {
      const current = state.messagesByConv[conversationId] ?? [];
      const finalMessage: ChatMessage = { ...message, deliveredOnline };
      let nextList: ChatMessage[];

      const idx = current.findIndex((m) => m.clientId === clientId);
      if (idx >= 0) {
        nextList = current.slice();
        nextList[idx] = finalMessage;
      } else if (!current.some((m) => m.id === message.id)) {
        nextList = [...current, finalMessage];
      } else {
        nextList = current.map((m) =>
          m.id === message.id ? { ...m, pending: false, deliveredOnline } : m
        );
      }

      const failed = new Set(state.failedClientIds);
      failed.delete(clientId);

      return {
        messagesByConv: { ...state.messagesByConv, [conversationId]: sortMessages(nextList) },
        failedClientIds: failed,
        conversations: touchConversation(state, conversationId, finalMessage),
      };
    }),

  markMessageFailed: (clientId) =>
    set((state) => {
      const messagesByConv: Record<string, ChatMessage[]> = {};
      for (const [convId, list] of Object.entries(state.messagesByConv)) {
        messagesByConv[convId] = list.map((m) =>
          m.clientId === clientId ? { ...m, pending: false } : m
        );
      }
      const failed = new Set(state.failedClientIds);
      failed.add(clientId);
      return { messagesByConv, failedClientIds: failed };
    }),

  markMessageDeleted: (conversationId, messageId, deletedAt) =>
    set((state) => {
      const current = state.messagesByConv[conversationId];
      const messagesByConv =
        current == null
          ? state.messagesByConv
          : {
              ...state.messagesByConv,
              [conversationId]: current.map((m) =>
                m.id === messageId ? { ...m, deletedAt } : m
              ),
            };

      // Keep the sidebar preview in sync when the deleted message is the last one.
      const conversations = state.conversations.map((c) =>
        c.id === conversationId && c.lastMessage?.id === messageId
          ? { ...c, lastMessage: { ...c.lastMessage, deletedAt } }
          : c
      );

      return { messagesByConv, conversations };
    }),

  incrementUnread: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c
      ),
    })),

  resetUnread: (conversationId) =>
    set((state) => {
      const conv = state.conversations.find((c) => c.id === conversationId);
      if (!conv || conv.unreadCount === 0) return state;
      return {
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        ),
      };
    }),

  markParticipantRead: (conversationId, userId, lastReadAt) =>
    set((state) => {
      let changed = false;
      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const participants = c.participants.map((p) => {
          if (p.userId !== userId) return p;
          if (timeOf(p.lastReadAt) >= timeOf(lastReadAt)) return p;
          changed = true;
          return { ...p, lastReadAt };
        });
        return changed ? { ...c, participants } : c;
      });
      return changed ? { conversations } : state;
    }),

  setPresenceSync: (onlineUserIds) => set({ onlineUserIds: new Set(onlineUserIds) }),

  setPresenceOnline: (userId) =>
    set((state) => {
      if (state.onlineUserIds.has(userId)) return state;
      const next = new Set(state.onlineUserIds);
      next.add(userId);
      return { onlineUserIds: next };
    }),

  setPresenceOffline: (userId, lastSeen) =>
    set((state) => {
      const next = new Set(state.onlineUserIds);
      next.delete(userId);
      return {
        onlineUserIds: next,
        lastSeenByUser: { ...state.lastSeenByUser, [userId]: lastSeen },
      };
    }),

  setTyping: (conversationId, entry) =>
    set((state) => {
      const current = state.typingByConv[conversationId] ?? [];
      const others = current.filter((t) => t.userId !== entry.userId);
      const next = entry.isTyping ? [...others, entry] : others;
      return {
        typingByConv: {
          ...state.typingByConv,
          [conversationId]: next,
        },
      };
    }),

  purgeTyping: () =>
    set((state) => {
      const now = Date.now();
      let changed = false;
      const typingByConv: Record<string, TypingEntry[]> = {};
      for (const [convId, entries] of Object.entries(state.typingByConv)) {
        const kept = entries.filter((t) => t.isTyping && now - t.at <= 6000);
        if (kept.length !== entries.length) {
          changed = true;
          if (kept.length > 0) typingByConv[convId] = kept;
        } else {
          typingByConv[convId] = entries;
        }
      }
      return changed ? { typingByConv } : state;
    }),

  reset: () =>
    set({
      me: null,
      conversations: [],
      messagesByConv: {},
      onlineUserIds: new Set<string>(),
      lastSeenByUser: {},
      typingByConv: {},
      failedClientIds: new Set<string>(),
      activeConvId: null,
      loadingConversations: false,
    }),
}));

// ---- Tick (delivery receipt) computation ----

const READ_GRACE_MS = 500;

export function computeTickState(
  message: ChatMessage,
  conversation: ConversationSummary | undefined,
  myId: string,
  onlineUserIds: Set<string>,
  failedClientIds: Set<string>
): TickState {
  if (message.pending) return "pending";
  if (message.clientId && failedClientIds.has(message.clientId)) return "failed";

  const others = (conversation?.participants ?? []).filter((p) => p.userId !== myId);
  const created = timeOf(message.createdAt);

  const allRead =
    others.length > 0 &&
    others.every((p) => timeOf(p.lastReadAt) >= created - READ_GRACE_MS);
  if (allRead) return "read";

  if (
    message.deliveredOnline ||
    others.some((p) => onlineUserIds.has(p.userId))
  ) {
    return "delivered";
  }
  return "sent";
}

export function getTypingPreview(
  state: Pick<ChatState, "typingByConv" | "me">,
  conversationId: string
): TypingEntry[] {
  const entries = state.typingByConv[conversationId] ?? [];
  return entries.filter((t) => t.isTyping && t.userId !== state.me?.id);
}

// Convenience selector for total unread count (used for the document title).
export function selectTotalUnread(state: Pick<ChatState, "conversations">): number {
  return state.conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}
