import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";

export const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarColor: true,
  about: true,
} as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const storedBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  return storedBuf.length === testBuf.length && timingSafeEqual(storedBuf, testBuf);
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function getSessionUser(token: string | null | undefined) {
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: PUBLIC_USER_SELECT } },
  });
  return session?.user ?? null;
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() || null : null;
}

export async function requireUser(req: Request) {
  return getSessionUser(bearerToken(req));
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}
