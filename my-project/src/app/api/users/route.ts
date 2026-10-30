import { db } from "@/lib/db";
import { jsonError, PUBLIC_USER_SELECT, requireUser } from "@/lib/auth";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  const users = await db.user.findMany({
    where: { id: { not: user.id } },
    select: PUBLIC_USER_SELECT,
    orderBy: { displayName: "asc" },
  });

  return Response.json({ users });
}
