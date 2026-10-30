import { createServer } from "http";
import { Server, type Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";

const PORT = 3003;

const prisma = new PrismaClient();

const httpServer = createServer();
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e7,
});

// userId -> sockets currently online for that user
const online = new Map<string, Set<string>>();
// conversationId -> userIds that have at least one socket joined in the room
const roomPresence = new Map<string, Set<string>>();

type AuthUser = { id: string; username: string; displayName: string; avatarColor: string };

function joinRoom(socket: Socket, conversationId: string, userId: string) {
  socket.join(`conv:${conversationId}`);
  const convIds: Set<string> = socket.data.convIds ?? new Set<string>();
  convIds.add(conversationId);
  socket.data.convIds = convIds;
  let users = roomPresence.get(conversationId);
  if (!users) {
    users = new Set<string>();
    roomPresence.set(conversationId, users);
  }
  users.add(userId);
}

function leaveAllRooms(socket: Socket) {
  const convIds: Set<string> = socket.data.convIds ?? new Set<string>();
  const userId: string = socket.data.userId;
  for (const convId of convIds) {
    const users = roomPresence.get(convId);
    if (!users) continue;
    // Only remove the user from room presence if no other online socket of the
    // same user still tracks this conversation.
    let remaining = 0;
    const userSockets = online.get(userId);
    if (userSockets) {
      for (const sid of userSockets) {
        const s = io.sockets.sockets.get(sid);
        if (s && (s.data.convIds as Set<string> | undefined)?.has(convId)) remaining++;
      }
    }
    if (remaining <= 1) users.delete(userId);
    if (users.size === 0) roomPresence.delete(convId);
  }
}

function publicMessage(
  m: {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: string;
    mediaUrl: string | null;
    createdAt: Date;
  },
  sender: AuthUser,
  replyTo: { id: string; content: string; type: string; senderId: string; senderName: string } | null,
  deliveredOnline: boolean,
  clientId?: string
) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderId: m.senderId,
    sender: { id: sender.id, displayName: sender.displayName, avatarColor: sender.avatarColor },
    content: m.content,
    type: m.type,
    mediaUrl: m.mediaUrl,
    replyTo,
    deletedAt: null as string | null,
    createdAt: m.createdAt.toISOString(),
    deliveredOnline,
    ...(clientId ? { clientId } : {}),
  };
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") {
      return next(new Error("unauthorized"));
    }
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarColor: true } },
      },
    });
    if (!session) return next(new Error("unauthorized"));
    socket.data.userId = session.user.id;
    socket.data.user = session.user;
    next();
  } catch (err) {
    next(err instanceof Error ? err : new Error("unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId: string = socket.data.userId;
  const user: AuthUser = socket.data.user;

  // ---- presence ----
  let sockets = online.get(userId);
  const firstSocket = !sockets || sockets.size === 0;
  if (!sockets) {
    sockets = new Set<string>();
    online.set(userId, sockets);
  }
  sockets.add(socket.id);

  prisma.user
    .update({ where: { id: userId }, data: { lastSeen: new Date() } })
    .catch(() => {});

  socket.emit("presence:sync", { onlineUserIds: [...online.keys()] });
  if (firstSocket) {
    socket.broadcast.emit("presence:online", { userId });
  }

  // ---- join conversation rooms ----
  socket.on("join", async (data: { conversationIds?: unknown }) => {
    const ids = Array.isArray(data?.conversationIds)
      ? data.conversationIds.filter((v): v is string => typeof v === "string")
      : [];
    for (const convId of ids.slice(0, 500)) {
      if (socket.data.convIds?.has(convId)) continue; // already joined
      try {
        const member = await prisma.conversationParticipant.findUnique({
          where: { conversationId_userId: { conversationId: convId, userId } },
          select: { id: true },
        });
        if (member) joinRoom(socket, convId, userId);
      } catch {
        // ignore join failures
      }
    }
  });

  // ---- send message ----
  socket.on(
    "message:send",
    async (
      payload: {
        conversationId?: unknown;
        content?: unknown;
        type?: unknown;
        mediaUrl?: unknown;
        replyToId?: unknown;
        clientId?: unknown;
      },
      ack?: (res: { ok: boolean; message?: unknown; error?: string }) => void
    ) => {
      try {
        const conversationId = typeof payload?.conversationId === "string" ? payload.conversationId : "";
        const type = payload?.type === "IMAGE" || payload?.type === "AUDIO" ? payload.type : "TEXT";
        const content = typeof payload?.content === "string" ? payload.content : "";
        const mediaUrl = typeof payload?.mediaUrl === "string" ? payload.mediaUrl : null;
        const replyToId = typeof payload?.replyToId === "string" && payload.replyToId ? payload.replyToId : null;
        const clientId = typeof payload?.clientId === "string" ? payload.clientId : undefined;

        if (!conversationId) return ack?.({ ok: false, error: "conversationId required" });
        if (content.length > 8000) return ack?.({ ok: false, error: "Message too long" });
        if (type === "TEXT" && !content.trim()) return ack?.({ ok: false, error: "Empty message" });
        if (type !== "TEXT" && !mediaUrl) return ack?.({ ok: false, error: "mediaUrl required" });

        const member = await prisma.conversationParticipant.findUnique({
          where: { conversationId_userId: { conversationId, userId } },
          select: { id: true },
        });
        if (!member) return ack?.({ ok: false, error: "Not a participant" });

        const created = await prisma.message.create({
          data: {
            conversationId,
            senderId: userId,
            content: content.trim(),
            type,
            mediaUrl,
            ...(replyToId ? { replyToId } : {}),
          },
        });

        let replyTo = null;
        if (replyToId) {
          const r = await prisma.message.findUnique({
            where: { id: replyToId },
            include: { sender: { select: { displayName: true } } },
          });
          if (r) {
            replyTo = {
              id: r.id,
              content: r.deletedAt ? "" : r.content,
              type: r.type,
              senderId: r.senderId,
              senderName: r.sender.displayName,
            };
          }
        }

        const others = roomPresence.get(conversationId);
        const deliveredOnline = !!others && [...others].some((uid) => uid !== userId);

        const full = publicMessage(created, user, replyTo, deliveredOnline, clientId);

        ack?.({ ok: true, message: full });
        io.to(`conv:${conversationId}`).emit("message:new", { message: full });
      } catch (err) {
        console.error("message:send error", err);
        ack?.({ ok: false, error: "Failed to send message" });
      }
    }
  );

  // ---- typing indicator ----
  socket.on("typing", (data: { conversationId?: unknown; isTyping?: unknown }) => {
    const conversationId = typeof data?.conversationId === "string" ? data.conversationId : "";
    if (!conversationId || !socket.data.convIds?.has(conversationId)) return;
    socket.to(`conv:${conversationId}`).emit("typing", {
      conversationId,
      userId,
      displayName: user.displayName,
      isTyping: !!data.isTyping,
    });
  });

  // ---- read receipt ----
  socket.on("read", async (data: { conversationId?: unknown }) => {
    const conversationId = typeof data?.conversationId === "string" ? data.conversationId : "";
    if (!conversationId || !socket.data.convIds?.has(conversationId)) return;
    try {
      const now = new Date();
      const updated = await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: now },
        select: { id: true },
      });
      if (updated) {
        io.to(`conv:${conversationId}`).emit("read", {
          conversationId,
          userId,
          lastReadAt: now.toISOString(),
        });
      }
    } catch {
      // not a participant or DB error — ignore
    }
  });

  // ---- delete for everyone ----
  socket.on(
    "message:delete",
    async (data: { messageId?: unknown }, ack?: (res: { ok: boolean; error?: string }) => void) => {
      try {
        const messageId = typeof data?.messageId === "string" ? data.messageId : "";
        if (!messageId) return ack?.({ ok: false, error: "messageId required" });
        const msg = await prisma.message.findUnique({ where: { id: messageId } });
        if (!msg) return ack?.({ ok: false, error: "Message not found" });
        if (msg.senderId !== userId) return ack?.({ ok: false, error: "Not allowed" });
        if (msg.deletedAt) return ack?.({ ok: true });
        const deletedAt = new Date();
        await prisma.message.update({ where: { id: messageId }, data: { deletedAt } });
        await prisma.message.updateMany({
          where: { id: messageId },
          data: { content: "" },
        });
        io.to(`conv:${msg.conversationId}`).emit("message:delete", {
          conversationId: msg.conversationId,
          messageId,
          deletedAt: deletedAt.toISOString(),
        });
        ack?.({ ok: true });
      } catch (err) {
        console.error("message:delete error", err);
        ack?.({ ok: false, error: "Failed to delete" });
      }
    }
  );

  // ---- disconnect ----
  socket.on("disconnect", async () => {
    const sockets = online.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        online.delete(userId);
        const lastSeen = new Date();
        prisma.user.update({ where: { id: userId }, data: { lastSeen } }).catch(() => {});
        io.emit("presence:offline", { userId, lastSeen: lastSeen.toISOString() });
      }
    }
    leaveAllRooms(socket);
  });

  socket.on("error", (error) => {
    console.error(`Socket error (${socket.id}):`, error);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Adda chat service running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  httpServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0));
});
