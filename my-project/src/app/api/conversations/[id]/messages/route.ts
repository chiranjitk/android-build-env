import { db } from "@/lib/db";
import { jsonError, requireUser } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const { id } = await params;

  const participant = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: user.id } },
  });
  if (!participant) return jsonError("Conversation not found", 404);

  const url = new URL(req.url);
  const limitRaw = parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 50 : limitRaw, 1), 100);
  const beforeRaw = url.searchParams.get("before");
  const before = beforeRaw ? new Date(beforeRaw) : null;

  const rows = await db.message.findMany({
    where: {
      conversationId: id,
      ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      sender: { select: { id: true, displayName: true, avatarColor: true } },
    },
  });

  // Resolve reply targets (plain string column, no FK relation)
  const replyIds = [...new Set(rows.map((m) => m.replyToId).filter((v): v is string => !!v))];
  const replyRows = replyIds.length
    ? await db.message.findMany({
        where: { id: { in: replyIds } },
        include: { sender: { select: { displayName: true } } },
      })
    : [];
  const replyMap = new Map(
    replyRows.map((r) => [
      r.id,
      {
        id: r.id,
        content: r.deletedAt ? "" : r.content,
        type: r.type,
        senderId: r.senderId,
        senderName: r.sender.displayName,
      },
    ])
  );

  const messages = rows
    .map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      sender: m.sender,
      content: m.deletedAt ? "" : m.content,
      type: m.type,
      mediaUrl: m.mediaUrl,
      replyTo: m.replyToId ? replyMap.get(m.replyToId) ?? null : null,
      deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
    }))
    .reverse(); // ascending order

  return Response.json({ messages });
}
