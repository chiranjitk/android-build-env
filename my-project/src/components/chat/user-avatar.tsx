"use client";

// Colored initials avatar with an optional online dot.

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  color?: string | null;
  size?: number;
  isGroup?: boolean;
  online?: boolean;
  className?: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.charAt(0) ?? "?";
  const second = parts.length > 1 ? (parts[1]?.charAt(0) ?? "") : "";
  return (first + second).toUpperCase();
}

export function UserAvatar({
  name,
  color,
  size = 49,
  isGroup = false,
  online = false,
  className,
}: UserAvatarProps) {
  const dotSize = Math.max(10, Math.round(size * 0.26));

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div
        className="flex h-full w-full select-none items-center justify-center overflow-hidden rounded-full font-medium text-white"
        style={{
          backgroundColor: isGroup ? "#54656f" : color || "#6a7175",
          fontSize: Math.max(12, Math.round(size * 0.36)),
          lineHeight: 1,
        }}
      >
        {isGroup ? (
          <Users style={{ width: size * 0.46, height: size * 0.46 }} />
        ) : (
          initialsOf(name)
        )}
      </div>
      {online && (
        <span
          className="absolute right-0 bottom-0 block rounded-full border-2 border-white bg-[#25d366] dark:border-[#233138]"
          style={{ width: dotSize, height: dotSize }}
        />
      )}
    </div>
  );
}
