// Typed REST client for the Adda chat app.
// Token lives in localStorage["adda_token"], current user in localStorage["adda_me"].
// Every authenticated request sends: Authorization: Bearer <token>.
// Any 401 response clears credentials and reloads back to the login screen.

import type { ChatMessage, ChatUser, ConversationSummary, Me } from "@/lib/chat-types";

const TOKEN_KEY = "adda_token";
const ME_KEY = "adda_me";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredMe(): Me | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Me;
    if (!parsed || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---- Auth state as an external store (hydration-safe via useSyncExternalStore) ----

export interface AuthSnapshot {
  token: string;
  me: Me;
}

let cachedAuth: AuthSnapshot | null | undefined;
const authListeners = new Set<() => void>();

function readAuthSnapshot(): AuthSnapshot | null {
  const token = getToken();
  const me = getStoredMe();
  return token && me ? { token, me } : null;
}

export function subscribeAuth(listener: () => void): () => void {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export function getAuthSnapshot(): AuthSnapshot | null {
  if (cachedAuth === undefined) cachedAuth = readAuthSnapshot();
  return cachedAuth;
}

export function getServerAuthSnapshot(): AuthSnapshot | null {
  return null;
}

export function setAuth(token: string, me: Me): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(ME_KEY, JSON.stringify(me));
  cachedAuth = { token, me };
  authListeners.forEach((listener) => listener());
}

export function updateStoredMe(me: Me): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ME_KEY, JSON.stringify(me));
  if (cachedAuth) {
    cachedAuth = { ...cachedAuth, me };
    authListeners.forEach((listener) => listener());
  }
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ME_KEY);
  cachedAuth = null;
  authListeners.forEach((listener) => listener());
}

function handle401(): never {
  clearAuth();
  if (typeof window !== "undefined") {
    window.location.reload();
  }
  throw new ApiError("Session expired", 401);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    handle401();
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // keep default message
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export interface NewConversationResult {
  conversation: { id: string; isGroup: boolean; name: string | null };
}

export interface CreateConversationPayload {
  isGroup: boolean;
  name?: string;
  memberIds: string[];
}

export const chatApi = {
  register(payload: { username: string; password: string; displayName: string }) {
    return request<{ token: string; user: Me }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  login(payload: { username: string; password: string }) {
    return request<{ token: string; user: Me }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me() {
    return request<{ user: Me }>("/api/auth/me");
  },

  updateProfile(payload: { displayName?: string; about?: string }) {
    return request<{ user: Me }>("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  users() {
    return request<{ users: ChatUser[] }>("/api/users");
  },

  conversations() {
    return request<{ conversations: ConversationSummary[] }>("/api/conversations");
  },

  createConversation(payload: CreateConversationPayload) {
    return request<NewConversationResult>("/api/conversations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  messages(conversationId: string, opts?: { limit?: number; before?: string }) {
    const params = new URLSearchParams();
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    if (opts?.before) params.set("before", opts.before);
    const qs = params.toString();
    return request<{ messages: ChatMessage[] }>(
      `/api/conversations/${encodeURIComponent(conversationId)}/messages${qs ? `?${qs}` : ""}`
    );
  },

  async upload(file: File): Promise<{ url: string; type: "IMAGE" | "AUDIO" }> {
    const form = new FormData();
    form.append("file", file);
    return request<{ url: string; type: "IMAGE" | "AUDIO" }>("/api/upload", {
      method: "POST",
      body: form,
    });
  },
};
