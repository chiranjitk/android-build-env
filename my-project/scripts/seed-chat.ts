// Seed script for Adda chat app — creates demo users so the app is usable immediately.
// Run: cd /home/z/my-project && bun scripts/seed-chat.ts
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function colorForUsername(username: string): string {
  const colors = ["#00a884", "#7f66ff", "#e542a3", "#df7843", "#0a7ea4", "#c4990e", "#6e7f3e", "#bf5b45"];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) >>> 0;
  return colors[hash % colors.length];
}

async function upsertUser(username: string, displayName: string, about: string) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return existing;
  return prisma.user.create({
    data: { username, displayName, about, password: hashPassword("1234"), avatarColor: colorForUsername(username) },
  });
}

async function main() {
  const chiranjit = await upsertUser("chiranjit", "Chiranjit", "Hey there! I am using Adda.");
  const demo1 = await upsertUser("mama", "Mama", "Family group admin 🏠");
  const demo2 = await upsertUser("bonna", "Bonna", "Adda time! 🎉");

  // A small welcome conversation so the app doesn't look empty on first login
  const existingConv = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      participants: { none: { userId: { notIn: [chiranjit.id, demo1.id] } } },
      AND: [
        { participants: { some: { userId: chiranjit.id } } },
        { participants: { some: { userId: demo1.id } } },
      ],
    },
  });

  if (!existingConv) {
    const conv = await prisma.conversation.create({
      data: { isGroup: false, participants: { create: [{ userId: chiranjit.id }, { userId: demo1.id }] } },
    });
    await prisma.message.createMany({
      data: [
        { conversationId: conv.id, senderId: demo1.id, content: "Ki khobor Chiranjit? Adda app ta launch holo! 🎉" },
        { conversationId: conv.id, senderId: demo1.id, content: "Ekhon theke nijer private chat — WhatsApp er moto but 100% amader 🇧🇩" },
        { conversationId: conv.id, senderId: chiranjit.id, content: "Darun! Test kore dekhi 💬" },
      ],
    });
    console.log("Seeded welcome conversation between chiranjit and mama");
  }

  console.log("Seeded users:", { chiranjit: chiranjit.username, mama: demo1.username, bonna: demo2.username });
  console.log("Password for all seeded users: 1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
