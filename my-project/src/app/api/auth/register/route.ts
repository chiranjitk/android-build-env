import { db } from "@/lib/db";
import { generateToken, hashPassword, isValidUsername, jsonError, PUBLIC_USER_SELECT } from "@/lib/auth";
import { colorForUsername } from "@/lib/chat-types";

export async function POST(req: Request) {
  let body: { username?: string; password?: string; displayName?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";
  const displayName = (body.displayName || "").trim();

  if (!isValidUsername(username)) {
    return jsonError("Username must be 3-20 characters (letters, numbers, underscore)", 400);
  }
  if (password.length < 4) {
    return jsonError("Password must be at least 4 characters", 400);
  }
  if (!displayName || displayName.length > 40) {
    return jsonError("Display name is required (max 40 characters)", 400);
  }

  const existing = await db.user.findUnique({ where: { username } });
  if (existing) {
    return jsonError("Username is already taken", 409);
  }

  const user = await db.user.create({
    data: {
      username,
      displayName,
      password: hashPassword(password),
      avatarColor: colorForUsername(username),
    },
    select: PUBLIC_USER_SELECT,
  });

  const token = generateToken();
  await db.session.create({ data: { token, userId: user.id } });

  return Response.json({ token, user }, { status: 201 });
}
