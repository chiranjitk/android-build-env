import { db } from "@/lib/db";
import { generateToken, jsonError, PUBLIC_USER_SELECT, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const username = (body.username || "").trim().toLowerCase();
  const password = body.password || "";

  if (!username || !password) {
    return jsonError("Username and password are required", 400);
  }

  const userWithPassword = await db.user.findUnique({ where: { username } });
  if (!userWithPassword || !verifyPassword(password, userWithPassword.password)) {
    return jsonError("Invalid username or password", 401);
  }

  const token = generateToken();
  await db.session.create({ data: { token, userId: userWithPassword.id } });

  const user = await db.user.findUnique({
    where: { id: userWithPassword.id },
    select: PUBLIC_USER_SELECT,
  });

  return Response.json({ token, user });
}
