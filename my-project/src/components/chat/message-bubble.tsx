"use client";

// A single chat bubble with ticks, reply quote, media and hover/long-press menu.

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Clock,
  Copy,
  MessageSquareReply,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDuration, formatTime12h } from "@/lib/chat-format";
import type { TickState } from "@/lib/chat-store";
import type { ChatMessage } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

export interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  isGroup: boolean;
  meId: string;
  tickState: TickState | null; // null for incoming messages (no ticks)
  onReply: () => void;
  onDelete: () => void;
  onImageClick: (url: string) => void;
  onQuoteClick: (messageId: string) => void;
  flash: boolean;
  registerRef: (messageId: string, el: HTMLDivElement | null) => void;
}

export function MessageBubble({
  message,
  isOwn,
  isGroup,
  meId,
  tickState,
  onReply,
  onDelete,
  onImageClick,
  onQuoteClick,
  flash,
  registerRef,
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  const deleted = Boolean(message.deletedAt);
  const showTicks = isOwn && tickState != null;

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => clearLongPress, []);

  const startLongPress = () => {
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      setMenuOpen(true);
    }, 550);
  };

  const handleCopy = () => {
    navigator.clipboard
      .writeText(message.content)
      .then(() => toast.success("Message copied"))
      .catch(() => toast.error("Could not copy message"));
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "flex px-3 sm:px-6",
        isOwn ? "justify-end" : "justify-start",
        message.type === "SYSTEM" && "justify-center"
      )}
    >
      <div
        ref={(el) => registerRef(message.id, el)}
        className={cn(
          "group relative max-w-[85%] rounded-lg sm:max-w-[75%]",
          flash && "adda-flash"
        )}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuOpen(true);
        }}
        onTouchStart={startLongPress}
        onTouchEnd={clearLongPress}
        onTouchMove={clearLongPress}
      >
        <div
          className={cn(
            "relative rounded-lg px-[9px] py-[6px] text-[14.2px] leading-[20px] shadow-sm dark:shadow-none",
            isOwn
              ? "adda-bubble-out rounded-br-sm bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]"
              : "adda-bubble-in rounded-bl-sm bg-white text-[#111b21] dark:bg-[#202c33] dark:text-[#e9edef]",
            message.type === "SYSTEM" &&
              "bg-[#ffeecd] text-center text-[12.5px] text-[#54656f] dark:bg-[#182229] dark:text-[#ffd279]",
            message.pending && "opacity-80",
            tickState === "failed" && "ring-1 ring-red-400"
          )}
        >
          {deleted ? (
            <p className="pr-16 italic text-[#667781] dark:text-[#8696a0]">
              <Ban className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
              <span aria-hidden="true">🚫</span> This message was deleted
            </p>
          ) : (
            <>
              {isGroup && !isOwn && (
                <p
                  className="mb-0.5 text-[12.5px] font-semibold"
                  style={{ color: message.sender.avatarColor || "#00a884" }}
                >
                  {message.sender.displayName}
                </p>
              )}

              {message.replyTo && <QuoteBlock message={message} meId={meId} onQuoteClick={onQuoteClick} />}

              {message.type === "IMAGE" && message.mediaUrl && (
                <button
                  type="button"
                  onClick={() => onImageClick(message.mediaUrl!)}
                  aria-label="Open image"
                  className="block cursor-zoom-in"
                >
                  <img
                    src={message.mediaUrl}
                    alt={message.content || "Shared photo"}
                    className="max-h-[300px] max-w-[300px] rounded-xl object-cover"
                    loading="lazy"
                  />
                </button>
              )}

              {message.type === "AUDIO" && message.mediaUrl && (
                <VoicePlayer src={message.mediaUrl} />
              )}

              {(message.type === "TEXT" || message.type === "SYSTEM") && message.content && (
                <p className="break-words whitespace-pre-wrap">{message.content}</p>
              )}
            </>
          )}

          {message.type !== "SYSTEM" && (
            <span
              className={cn(
                "text-[11px] leading-none tabular-nums text-[#667781] dark:text-[#8696a0]",
                message.type === "IMAGE" || message.type === "AUDIO"
                  ? "mt-1 flex items-center justify-end gap-1"
                  : "absolute right-2.5 bottom-[5px] inline-flex items-center gap-1"
              )}
            >
              {formatTime12h(message.createdAt)}
              {showTicks && <TickIcon state={tickState} />}
            </span>
          )}
        </div>

        {/* Hover / long-press action menu */}
        {!deleted && message.type !== "SYSTEM" && (
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Message options"
                className={cn(
                  "absolute top-0.5 right-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-[#667781] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none dark:text-[#8696a0]",
                  menuOpen && "opacity-100",
                  isOwn
                    ? "bg-[#ffffff66] hover:bg-[#ffffffaa] dark:bg-[#182229]"
                    : "bg-[#00000008] hover:bg-[#00000014] dark:bg-[#2a3942]"
                )}
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOwn ? "end" : "start"} className="z-50">
              <DropdownMenuItem
                disabled={message.pending}
                onSelect={() => {
                  setMenuOpen(false);
                  onReply();
                }}
              >
                <MessageSquareReply aria-hidden="true" />
                Reply
              </DropdownMenuItem>
              {message.type === "TEXT" && (
                <DropdownMenuItem
                  onSelect={() => {
                    setMenuOpen(false);
                    handleCopy();
                  }}
                >
                  <Copy aria-hidden="true" />
                  Copy
                </DropdownMenuItem>
              )}
              {isOwn && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={message.pending}
                    onSelect={() => {
                      setMenuOpen(false);
                      setConfirmOpen(true);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete for everyone?</AlertDialogTitle>
              <AlertDialogDescription>
                This message will be deleted for everyone in this chat. This
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-500 text-white hover:bg-red-600"
                onClick={() => onDelete()}
              >
                Delete for everyone
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  );
}

function QuoteBlock({
  message,
  meId,
  onQuoteClick,
}: {
  message: ChatMessage;
  meId: string;
  onQuoteClick: (messageId: string) => void;
}) {
  const replyTo = message.replyTo;
  if (!replyTo) return null;
  return (
    <button
      type="button"
      onClick={() => onQuoteClick(replyTo.id)}
      aria-label="Jump to quoted message"
      className="mb-1 block w-full cursor-pointer overflow-hidden rounded bg-black/5 text-left dark:bg-white/10"
    >
      <span className="block border-l-4 border-[#00a884] px-2 py-1">
        <span className="block truncate text-[12.5px] font-semibold text-[#008069] dark:text-[#25d366]">
          {replyTo.senderId === meId ? "You" : replyTo.senderName}
        </span>
        <span className="block truncate text-[12.5px] text-[#667781] dark:text-[#8696a0]">
          {quotePreviewText(replyTo.type, replyTo.content)}
        </span>
      </span>
    </button>
  );
}

function quotePreviewText(type: ChatMessage["type"], content: string): string {
  switch (type) {
    case "IMAGE":
      return "📷 Photo";
    case "AUDIO":
      return "🎤 Voice note";
    case "SYSTEM":
      return content;
    default:
      return content;
  }
}

export function TickIcon({ state }: { state: TickState }) {
  switch (state) {
    case "pending":
      return <Clock className="h-3.5 w-3.5" aria-label="Pending" />;
    case "failed":
      return <CircleAlert className="h-3.5 w-3.5 text-red-500" aria-label="Failed" />;
    case "sent":
      return (
        <Check
          className="h-4 w-4 text-[#667781] dark:text-[#8696a0]"
          aria-label="Sent"
        />
      );
    case "delivered":
      return (
        <CheckCheck
          className="h-4 w-4 text-[#667781] dark:text-[#8696a0]"
          aria-label="Delivered"
        />
      );
    case "read":
      return <CheckCheck className="h-4 w-4 text-[#53bdeb]" aria-label="Read" />;
    default:
      return null;
  }
}

// ---- Voice note player ----

function VoicePlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) {
        audio.pause();
      }
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play().catch(() => toast.error("Could not play voice message"));
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
      return;
    }
    // Chrome records webm blobs without duration metadata — force a seek
    // trick to compute it once.
    const onTimeUpdate = () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      audio.currentTime = 0;
    };
    audio.addEventListener("timeupdate", onTimeUpdate);
    try {
      audio.currentTime = 1e7;
    } catch {
      audio.removeEventListener("timeupdate", onTimeUpdate);
    }
  };

  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="flex w-[210px] items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#00a884] text-white transition-colors hover:bg-[#017561] focus-visible:ring-2 focus-visible:ring-[#00a884] focus-visible:outline-none"
      >
        {playing ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="ml-0.5 h-4 w-4" aria-hidden="true" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-[#c8cbcb] dark:bg-[#3b4a54]"
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Voice message progress"
        >
          <div className="h-full bg-[#00a884]" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-0.5 flex justify-between text-[10.5px] tabular-nums text-[#667781] dark:text-[#8696a0]">
          <span>{formatDuration(position)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        className="hidden"
      />
    </div>
  );
}
