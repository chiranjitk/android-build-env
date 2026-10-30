// Small date/duration formatting helpers shared by Adda UI components.

import { format, isToday, isYesterday } from "date-fns";

/** "9:41 AM" */
export function formatTime12h(date: Date | string | number): string {
  return format(new Date(date), "h:mm a");
}

/** Sidebar row time: today -> 9:41 AM, yesterday -> "Yesterday", else dd/mm/yyyy. */
export function formatConversationTime(date: Date | string | number): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd/MM/yyyy");
}

/** Date separator chip label: TODAY / YESTERDAY / 12 OCTOBER 2025 */
export function formatDayLabel(date: Date | string | number): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return "TODAY";
  if (isYesterday(d)) return "YESTERDAY";
  return format(d, "d MMMM yyyy").toUpperCase();
}

/** Voice message duration: m:ss */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
