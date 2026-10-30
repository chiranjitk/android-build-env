// Shared types for the Adda chat app (frontend + API contract)

export type MessageType = "TEXT" | "IMAGE" | "AUDIO" | "SYSTEM";

export interface ChatUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  about: string;
}

export type Me = ChatUser;

export interface ParticipantInfo {
  userId: string;
  lastReadAt: string;
  user: ChatUser;
}

export interface LastMessagePreview {
  id: string;
  content: string;
  type: MessageType;
  senderId: string;
  createdAt: string;
  deletedAt: string | null;
}

export interface ConversationSummary {
  id: string;
  isGroup: boolean;
  name: string | null; // group name; for 1:1 chats use otherUser.displayName
  otherUser: ChatUser | null; // for 1:1 chats
  participants: ParticipantInfo[];
  lastMessage: LastMessagePreview | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ReplyPreview {
  id: string;
  content: string;
  type: MessageType;
  senderId: string;
  senderName: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender: {
    id: string;
    displayName: string;
    avatarColor: string;
  };
  content: string;
  type: MessageType;
  mediaUrl: string | null;
  replyTo: ReplyPreview | null;
  deletedAt: string | null;
  createdAt: string;
  // client-side only fields
  pending?: boolean;
  clientId?: string;
  deliveredOnline?: boolean;
}

// ---- REST API contracts ----
// POST /api/auth/register  { username, password, displayName } -> { token, user: Me }
// POST /api/auth/login     { username, password }               -> { token, user: Me }
// GET  /api/auth/me        (Bearer)                             -> { user: Me }
// PATCH /api/profile       (Bearer) { displayName?, about? }     -> { user: Me }
// GET  /api/users          (Bearer)                             -> { users: ChatUser[] }
// GET  /api/conversations  (Bearer)                             -> { conversations: ConversationSummary[] }
// POST /api/conversations  (Bearer) { isGroup, name?, memberIds } -> { conversation: { id, isGroup, name } }
// GET  /api/conversations/{id}/messages?limit=50&before=<ISO> (Bearer) -> { messages: ChatMessage[] } (asc order)
// POST /api/upload         (Bearer, multipart field "file")     -> { url: string, type: "IMAGE" | "AUDIO" }

// ---- Socket.io contract (connect via io('/?XTransformPort=3003', { transports: ['websocket','polling'], auth: { token } })) ----
// Server -> Client:
//   presence:sync   { onlineUserIds: string[] }                       (right after connect)
//   presence:online { userId }
//   presence:offline { userId, lastSeen }
//   message:new     { message: ChatMessage }                          (room broadcast, includes own sends)
//   typing          { conversationId, userId, displayName, isTyping }
//   read            { conversationId, userId, lastReadAt }
//   message:delete  { conversationId, messageId, deletedAt }
// Client -> Server (emit):
//   join            { conversationIds: string[] }
//   message:send    { conversationId, content, type, mediaUrl?, replyToId?, clientId } ack -> { ok, message?: ChatMessage, error? }
//   typing          { conversationId, isTyping }
//   read            { conversationId }
//   message:delete  { messageId } ack -> { ok } | { ok: false, error }

export const AVATAR_COLORS = [
  "#00a884",
  "#7f66ff",
  "#e542a3",
  "#df7843",
  "#0a7ea4",
  "#c4990e",
  "#6e7f3e",
  "#bf5b45",
];

export function colorForUsername(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
