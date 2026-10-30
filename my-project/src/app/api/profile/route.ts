import { db } from "@/lib/db";
import { jsonError, PUBLIC_USER_SELECT, requireUser } from "@/lib/auth";

export async function PATCH(req: Request) {
  const user = await requireUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  let body: { displayName?: string; about?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const data: { displayName?: string; about?: string } = {};
  if (body.displayName !== undefined) {
    const displayName = body.displayName.trim();
    if (!displayName || displayName.length > 40) {
      return jsonError("Display name is required (max 40 characters)", 400);
    }
    data.displayName = displayName;
  }
  if (body.about !== undefined) {
    const about = body.about.trim();
    if (about.length > 139) {
      return jsonError("About must be max 139 characters", 400);
    }
    data.about = about;
  }
  if (Object.keys(data).length === 0) {
    return jsonError("Nothing to update", 400);
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data,
    select: PUBLIC_USER_SELECT,
  });

  return Response.json({ user: updated });
}
