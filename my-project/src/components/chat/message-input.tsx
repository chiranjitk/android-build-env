"use client";

// Composer: emoji picker, image attach, voice recorder, text input, send.

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Paperclip, SendHorizonal, Smile, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useChatSocket } from "@/components/chat/socket-provider";
import { chatApi } from "@/lib/chat-api";
import { formatDuration } from "@/lib/chat-format";
import { useChatStore } from "@/lib/chat-store";
import type { ChatMessage, MessageType, ReplyPreview } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊",
  "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜",
  "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶",
  "😏", "😒", "🙄", "😬", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕",
  "🤢", "🤮", "🥵", "🥶", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕",
  "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥",
  "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡",
  "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👏", "🙌", "🤝", "🙏", "💪",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💖", "💗", "💓", "💞",
  "🔥", "✨", "🎉", "🎊", "🎁", "🌹", "🌸", "🍵", "☕", "🍰", "🍕", "🍪",
  "⚽", "🏏", "🎮", "🎧", "📚", "✈️", "🚗", "🌧️", "⛅", "🌙", "⭐", "🌈",
  "💯", "👋", "🤙", "🫶", "🐱", "🐶", "🦋", "🌊", "🍀", "🌞", "🪴", "🌺",
];

const MAX_RECORD_SECONDS = 60;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface MessageInputProps {
  conversationId: string;
  replyTo: ReplyPreview | null;
  onCancelReply: () => void;
}

interface SendAck {
  ok: boolean;
  message?: ChatMessage;
  error?: string;
}

export function MessageInput({ conversationId, replyTo, onCancelReply }: MessageInputProps) {
  const { socket } = useChatSocket();
  const me = useChatStore((s) => s.me);

  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingActiveRef = useRef(false);
  const typingTimerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);
  const recSecondsRef = useRef(0);
  const cancelledRef = useRef(false);
  const replyToRef = useRef<ReplyPreview | null>(replyTo);
  replyToRef.current = replyTo;

  // Cleanup recording artifacts on unmount.
  useEffect(() => {
    return () => {
      if (typingTimerRef.current != null) window.clearTimeout(typingTimerRef.current);
      if (recTimerRef.current != null) window.clearInterval(recTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const emitTyping = (isTyping: boolean) => {
    socket?.emit("typing", { conversationId, isTyping });
  };

  const signalTyping = () => {
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      emitTyping(true);
    }
    if (typingTimerRef.current != null) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      typingActiveRef.current = false;
      emitTyping(false);
    }, 2000);
  };

  const stopTyping = () => {
    if (typingTimerRef.current != null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      emitTyping(false);
    }
  };

  const dispatchSend = (payload: { content: string; type: MessageType; mediaUrl?: string }) => {
    const state = useChatStore.getState();
    const myId = state.me?.id;
    if (!socket || !myId) {
      toast.error("Not connected yet — try again in a moment");
      return;
    }
    const clientId = crypto.randomUUID();
    const currentReply = replyToRef.current;

    const optimistic: ChatMessage = {
      id: `temp-${clientId}`,
      conversationId,
      senderId: myId,
      sender: {
        id: myId,
        displayName: state.me?.displayName ?? "Me",
        avatarColor: state.me?.avatarColor ?? "#00a884",
      },
      content: payload.content,
      type: payload.type,
      mediaUrl: payload.mediaUrl ?? null,
      replyTo: currentReply,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      pending: true,
      clientId,
    };
    state.applyOptimistic(conversationId, optimistic);

    socket.emit(
      "message:send",
      {
        conversationId,
        content: payload.content,
        type: payload.type,
        mediaUrl: payload.mediaUrl,
        replyToId: currentReply?.id,
        clientId,
      },
      (ack: SendAck) => {
        if (ack?.ok && ack.message) {
          const fresh = useChatStore.getState();
          const othersOnline =
            fresh.conversations
              .find((c) => c.id === conversationId)
              ?.participants.some(
                (p) => p.userId !== myId && fresh.onlineUserIds.has(p.userId)
              ) ?? false;
          fresh.applyAck(
            conversationId,
            clientId,
            ack.message,
            othersOnline || ack.message.deliveredOnline === true
          );
        } else {
          useChatStore.getState().markMessageFailed(clientId);
          toast.error(ack?.error || "Failed to send message");
        }
      }
    );

    onCancelReply();
  };

  const sendText = () => {
    const content = text.trim();
    if (!content) return;
    stopTyping();
    setText("");
    dispatchSend({ content, type: "TEXT" });
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + emoji + el.value.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
    });
  };

  const handleFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files can be attached");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be smaller than 10 MB");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await chatApi.upload(file);
      dispatchSend({ content: "", type: "IMAGE", mediaUrl: uploaded.url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  // ---- Voice recording ----

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording is not supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        if (recTimerRef.current != null) {
          window.clearInterval(recTimerRef.current);
          recTimerRef.current = null;
        }
        const wasCancelled = cancelledRef.current;
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setRecording(false);
        if (!wasCancelled && blob.size > 0) {
          void sendVoice(blob);
        }
        recSecondsRef.current = 0;
        setRecSeconds(0);
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecSeconds(0);
      recSecondsRef.current = 0;
      recTimerRef.current = window.setInterval(() => {
        const next = recSecondsRef.current + 1;
        recSecondsRef.current = next;
        setRecSeconds(next);
        if (next >= MAX_RECORD_SECONDS) stopRecording(true);
      }, 1000);
    } catch {
      toast.error("Microphone permission denied");
    }
  };

  const stopRecording = (send: boolean) => {
    cancelledRef.current = !send;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (recTimerRef.current != null) {
        window.clearInterval(recTimerRef.current);
        recTimerRef.current = null;
      }
      setRecording(false);
    }
  };

  const sendVoice = async (blob: Blob) => {
    setUploading(true);
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const uploaded = await chatApi.upload(file);
      dispatchSend({ content: "", type: "AUDIO", mediaUrl: uploaded.url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Voice message upload failed");
    } finally {
      setUploading(false);
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="shrink-0 px-2 pt-1 pb-2 sm:px-4 sm:pb-3">
      {replyTo && (
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border-l-4 border-[#00a884] bg-[#f0f2f5] px-3 py-2 dark:bg-[#202c33]">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#00a884] dark:text-[#25d366]">
              {replyTo.senderId === me?.id ? "You" : replyTo.senderName}
            </p>
            <p className="truncate text-xs text-[#667781] dark:text-[#8696a0]">
              {replyTo.type === "IMAGE"
                ? "📷 Photo"
                : replyTo.type === "AUDIO"
                  ? "🎤 Voice message"
                  : replyTo.content || "Message"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="cursor-pointer rounded-full p-1 text-[#667781] hover:bg-black/5 dark:text-[#8696a0] dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div
        className={cn(
          "flex items-center gap-1 bg-[#f0f2f5] dark:bg-[#202c33]",
          replyTo ? "rounded-[22px]" : "rounded-full"
        )}
      >
        {recording ? (
          <>
            <button
              type="button"
              onClick={() => stopRecording(false)}
              aria-label="Cancel recording"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-red-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
              <span className="adda-rec-pulse inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
              <span className="text-sm font-medium tabular-nums text-red-500">
                Recording {formatDuration(recSeconds)} / {formatDuration(MAX_RECORD_SECONDS)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => stopRecording(true)}
              aria-label="Send voice message"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#00a884] hover:bg-black/5 dark:hover:bg-white/10"
            >
              <SendHorizonal className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Insert emoji"
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#54656f] hover:text-[#3b4a54] dark:text-[#8696a0] dark:hover:text-[#aebac1]"
                >
                  <Smile className="h-6 w-6" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-[336px] p-2">
                <div className="adda-scroll grid max-h-56 grid-cols-12 gap-0.5 overflow-y-auto">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      aria-label={`Insert ${emoji}`}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-[17px] leading-none hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942]"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <input
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.trim()) signalTyping();
                else stopTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              placeholder="Type a message"
              aria-label="Type a message"
              maxLength={4096}
              className="h-10 min-w-0 flex-1 bg-transparent text-[15px] text-[#111b21] outline-none placeholder:text-[#667781] dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChosen}
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Attach an image"
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#54656f] hover:text-[#3b4a54] disabled:cursor-not-allowed dark:text-[#8696a0] dark:hover:text-[#aebac1]"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              ) : (
                <Paperclip className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            {hasText ? (
              <button
                type="button"
                onClick={sendText}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#00a884] hover:text-[#017561]"
              >
                <SendHorizonal className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void startRecording()}
                aria-label="Record a voice message"
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#54656f] hover:text-[#3b4a54] dark:text-[#8696a0] dark:hover:text-[#aebac1]"
              >
                <Mic className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
