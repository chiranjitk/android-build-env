"use client";

// Socket.io lifecycle for the Adda chat app.
// Connects with the auth token, handles every server event and keeps the
// zustand store in sync. The socket + connection status are exposed through a
// tiny external store (useSyncExternalStore) so consumers re-render safely
// without setState-in-effect or render-time ref access.

import { useCallback, useEffect, useRef } from "react";
import { useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import type { ChatMessage } from "@/lib/chat-types";
import { clearAuth } from "@/lib/chat-api";
import { useChatStore } from "@/lib/chat-store";

export interface SocketState {
  socket: Socket | null;
  connected: boolean;
}

const SERVER_SOCKET_STATE: SocketState = { socket: null, connected: false };
let socketState: SocketState = { socket: null, connected: false };
let joinedSig = "";
const socketListeners = new Set<() => void>();

function setSocketState(patch: Partial<SocketState>): void {
  socketState = { ...socketState, ...patch };
  socketListeners.forEach((listener) => listener());
}

function subscribeSocketState(listener: () => void): () => void {
  socketListeners.add(listener);
  return () => {
    socketListeners.delete(listener);
  };
}

function getSocketSnapshot(): SocketState {
  return socketState;
}

function getServerSocketSnapshot(): SocketState {
  return SERVER_SOCKET_STATE;
}

export function useChatSocket(): SocketState {
  return useSyncExternalStore(subscribeSocketState, getSocketSnapshot, getServerSocketSnapshot);
}

// ---- Notification helpers ----

let audioCtx: AudioContext | null = null;

function playNotificationBeep(): void {
  try {
    if (typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!audioCtx) audioCtx = new Ctor();
    const ctx = audioCtx;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
    gain.gain.setValueAtTime(0.06, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  } catch {
    // Audio is best-effort only.
  }
}

function messageBodyPreview(message: ChatMessage): string {
  if (message.deletedAt) return "🚫 Message deleted";
  switch (message.type) {
    case "IMAGE":
      return "📷 Photo";
    case "AUDIO":
      return "🎤 Voice message";
    default:
      return message.content;
  }
}

function notifyIncoming(message: ChatMessage): void {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  const senderName = message.sender?.displayName || "New message";
  const body = messageBodyPreview(message);

  // NOTE: never auto-request permission here — requestPermission() must only
  // ever run from an explicit user gesture, otherwise browsers may block it
  // (and headless environments can hang). Notifications simply work when the
  // user has already granted permission for this origin.
  if (Notification.permission !== "granted") return;

  try {
    const notification = new Notification(senderName, {
      body,
      tag: `adda-${message.conversationId}`,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Notification API can be unavailable (e.g. insecure context).
  }
}

// ---- Provider ----

interface SocketProviderProps {
  token: string;
  onUnauthorized: () => void;
  children: React.ReactNode;
}

export function SocketProvider({ token, onUnauthorized, children }: SocketProviderProps) {
  const onUnauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    onUnauthorizedRef.current = onUnauthorized;
  }, [onUnauthorized]);

  const emitJoin = useCallback((sock: Socket, force: boolean) => {
    const ids = useChatStore.getState().conversations.map((c) => c.id);
    const sig = [...ids].sort().join(",");
    if (!force && joinedSig === sig) return;
    joinedSig = sig;
    sock.emit("join", { conversationIds: ids });
  }, []);

  useEffect(() => {
    const sock = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      timeout: 10000,
      auth: { token },
    });
    setSocketState({ socket: sock, connected: false });

    const store = () => useChatStore.getState();

    const handleIncoming = (message: ChatMessage) => {
      const st = store();
      const myId = st.me?.id;
      const isActiveFocused =
        st.activeConvId === message.conversationId &&
        typeof document !== "undefined" &&
        document.hasFocus();

      st.appendServerMessage(message.conversationId, message, myId ?? "");

      if (message.senderId === myId) {
        // Own message echoed from another session: if it is on screen, mark read.
        if (isActiveFocused) {
          sock.emit("read", { conversationId: message.conversationId });
          st.resetUnread(message.conversationId);
        }
        return;
      }

      if (isActiveFocused) {
        st.resetUnread(message.conversationId);
        sock.emit("read", { conversationId: message.conversationId });
      } else {
        st.incrementUnread(message.conversationId);
        playNotificationBeep();
        notifyIncoming(message);
      }
    };

    const onConnect = () => {
      setSocketState({ connected: true });
      joinedSig = "";
      emitJoin(sock, true);
    };
    const onDisconnect = () => setSocketState({ connected: false });
    const onConnectError = (err: Error) => {
      setSocketState({ connected: false });
      if (err.message === "unauthorized") {
        clearAuth();
        onUnauthorizedRef.current();
      }
    };

    sock.on("connect", onConnect);
    sock.on("disconnect", onDisconnect);
    sock.on("connect_error", onConnectError);
    sock.on("presence:sync", (data: { onlineUserIds: string[] }) =>
      store().setPresenceSync(data.onlineUserIds ?? [])
    );
    sock.on("presence:online", (data: { userId: string }) =>
      store().setPresenceOnline(data.userId)
    );
    sock.on("presence:offline", (data: { userId: string; lastSeen: string }) =>
      store().setPresenceOffline(data.userId, data.lastSeen)
    );
    sock.on("message:new", (data: { message: ChatMessage }) => handleIncoming(data.message));
    sock.on(
      "typing",
      (data: {
        conversationId: string;
        userId: string;
        displayName: string;
        isTyping: boolean;
      }) => {
        store().setTyping(data.conversationId, {
          userId: data.userId,
          displayName: data.displayName,
          isTyping: data.isTyping,
          at: Date.now(),
        });
      }
    );
    sock.on(
      "read",
      (data: { conversationId: string; userId: string; lastReadAt: string }) =>
        store().markParticipantRead(data.conversationId, data.userId, data.lastReadAt)
    );
    sock.on(
      "message:delete",
      (data: { conversationId: string; messageId: string; deletedAt: string }) =>
        store().markMessageDeleted(data.conversationId, data.messageId, data.deletedAt)
    );

    // Re-emit `join` whenever the conversation list changes.
    const unsubscribe = useChatStore.subscribe((state, prev) => {
      if (state.conversations !== prev.conversations && sock.connected) {
        emitJoin(sock, false);
      }
    });

    // Safety net: drop stale typing indicators.
    const purgeTimer = window.setInterval(() => {
      store().purgeTyping();
    }, 3000);

    return () => {
      unsubscribe();
      window.clearInterval(purgeTimer);
      sock.removeAllListeners();
      sock.disconnect();
      joinedSig = "";
      setSocketState({ socket: null, connected: false });
    };
  }, [token, emitJoin]);

  return <>{children}</>;
}
