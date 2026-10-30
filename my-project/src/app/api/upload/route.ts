import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { jsonError, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-m4a": "m4a",
};

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (!user) return jsonError("Unauthorized", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Expected multipart form data", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("Missing 'file' field", 400);
  }
  if (file.size > MAX_BYTES) {
    return jsonError("File too large (max 10MB)", 413);
  }

  const mime = file.type || "";
  const ext = EXT_BY_MIME[mime];
  if (!ext || (!mime.startsWith("image/") && !mime.startsWith("audio/"))) {
    return jsonError("Only image or audio files are allowed", 415);
  }

  const name = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, name), buffer);

  return Response.json({
    url: `/uploads/${name}`,
    type: mime.startsWith("audio/") ? "AUDIO" : "IMAGE",
  });
}
