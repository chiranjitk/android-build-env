import { db } from "@/lib/db";
import { jsonError, requireUser } from "@/lib/auth";

function lastMessagePreview(m: {
  id: string;
  content: string;
  type: string;
  senderId: string;
  createdAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: m.id,
    content: m.deletedAt ? "" : m.content,
    type: m.type,
    senderId: m.senderId,
    createdAt: m.createdAt.toISOString(),
    deletedAt: m.deletedAt ? m.deletedAt.toISOString() : null,
  };
}

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const participations = await db.conversationParticipant.findMany({
    where: { userId: user.id },
    include: {
      conversation: {
        include: {
          participants: { include: { user: { select: { id: true, username: true, displayName: true, avatarColor: true, about: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  const conversations = await Promise.all(
    participations.map(async (p) => {
      const conv = p.conversation;
      const last = conv.messages[0] ?? null;

      const unreadCount = await db.message.count({
        where: {
          conversationId: conv.id,
          senderId: { not: user.id },
          deletedAt: null,
          createdAt: { gt: p.lastReadAt },
        },
      });

      const otherParticipant = conv.isGroup
        ? null
        : conv.participants.find((x) => x.userId !== user.id) ?? null;

      return {
        id: conv.id,
        isGroup: conv.isGroup,
        name: conv.name,
        otherUser: otherParticipant ? otherParticipant.user : null,
        participants: conv.participants.map((x) => ({
          userId: x.userId,
          lastReadAt: x.lastReadAt.toISOString(),
          user: x.user,
        })),
        lastMessage: last ? lastMessagePreview(last) : null,
        unreadCount,
        updatedAt: (last ? last.createdAt : conv.createdAt).toISOString(),
      };
    })
  );

  conversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return Response.json({ conversations });
}

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  let body: { isGroup?: boolean; name?: string; memberIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const memberIds = Array.isArray(body.memberIds) ? body.memberIds.filter((id): id is string => typeof id === "string") : [];
  const isGroup = !!body.isGroup;

  if (isGroup) {
    const name = (body.name || "").trim();
    if (!name || name.length > 50) {
      return jsonError("Group name is required (max 50 characters)", 400);
    }
    const uniqueMembers = [...new Set(memberIds.filter((id) => id !== user.id))];
    if (uniqueMembers.length < 1) {
      return jsonError("Select at least 1 member for the group", 400);
    }
    const found = await db.user.findMany({ where: { id: { in: uniqueMembers } }, select: { id: true } });
    if (found.length !== uniqueMembers.length) {
      return jsonError("One or more members do not exist", 400);
    }
    const conv = await db.conversation.create({
      data: {
        isGroup: true,
        name,
        participants: {
          create: [user.id, ...uniqueMembers].map((userId) => ({ userId })),
        },
      },
    });
    return Response.json({ conversation: { id: conv.id, isGroup: true, name: conv.name } }, { status: 201 });
  }

  // 1:1 chat
  const otherId = memberIds[0];
  if (!otherId || otherId === user.id) {
    return jsonError("A valid other member is required", 400);
  }
  const other = await db.user.findUnique({ where: { id: otherId }, select: { id: true } });
  if (!other) return jsonError("User does not exist", 400);

  // Dedupe: find existing 1:1 conversation with exactly these two members
  const existing = await db.conversation.findFirst({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId: user.id } } },
        { participants: { some: { userId: otherId } } },
        { participants: { none: { userId: { notIn: [user.id, otherId] } } } },
      ],
    },
    select: { id: true, isGroup: true, name: true },
  });
  if (existing) {
    return Response.json({ conversation: existing });
  }

  const conv = await db.conversation.create({
    data: {
      isGroup: false,
      participants: { create: [{ userId: user.id }, { userId: otherId }] },
    },
  });
  return Response.json({ conversation: { id: conv.id, isGroup: false, name: null } }, { status: 201 });
}
