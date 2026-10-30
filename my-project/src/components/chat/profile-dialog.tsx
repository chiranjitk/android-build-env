"use client";

// Profile editor: display name, about, theme switch, logout.

import { useEffect, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/chat/user-avatar";
import { useHydrated } from "@/hooks/use-hydrated";
import { chatApi, updateStoredMe } from "@/lib/chat-api";
import { useChatStore } from "@/lib/chat-store";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
}

export function ProfileDialog({ open, onOpenChange, onLogout }: ProfileDialogProps) {
  const me = useChatStore((s) => s.me);
  const setMe = useChatStore((s) => s.setMe);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHydrated();

  const [displayName, setDisplayName] = useState("");
  const [about, setAbout] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && me) {
      setDisplayName(me.displayName);
      setAbout(me.about ?? "");
    }
  }, [open, me]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || !me) return;
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await chatApi.updateProfile({
        displayName: displayName.trim(),
        about: about.trim(),
      });
      setMe(res.user);
      updateStoredMe(res.user);
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto bg-white sm:max-w-sm dark:bg-[#111b21]">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
          <DialogDescription className="sr-only">
            Edit your display name and about text
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-1 pb-2">
          <UserAvatar
            name={me?.displayName ?? "Me"}
            color={me?.avatarColor}
            size={96}
          />
          <p className="mt-1 text-xs text-[#667781] dark:text-[#8696a0]">
            @{me?.username ?? ""}
          </p>
        </div>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="adda-profile-name" className="text-[#00a884] dark:text-[#25d366]">
              Your name
            </Label>
            <Input
              id="adda-profile-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="border-b border-t-0 border-r border-l-0 border-[#d1d7db] bg-transparent px-0 shadow-none focus-visible:ring-0 dark:border-[#3b4a54]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adda-profile-about" className="text-[#00a884] dark:text-[#25d366]">
              About
            </Label>
            <Input
              id="adda-profile-about"
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Hey there! I am using Adda."
              maxLength={120}
              className="border-b border-t-0 border-r border-l-0 border-[#d1d7db] bg-transparent px-0 shadow-none focus-visible:ring-0 dark:border-[#3b4a54]"
            />
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="h-10 w-full cursor-pointer bg-[#00a884] text-white hover:bg-[#017561]"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Save profile
          </Button>
        </form>

        <div className="flex items-center justify-between rounded-lg bg-[#f0f2f5] px-3 py-2.5 dark:bg-[#202c33]">
          <span className="text-sm text-[#111b21] dark:text-[#e9edef]">Dark theme</span>
          <Switch
            checked={mounted && resolvedTheme === "dark"}
            onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            aria-label="Toggle dark theme"
            className="data-[state=checked]:bg-[#00a884]"
          />
        </div>

        <Button
          variant="outline"
          onClick={onLogout}
          className="h-10 w-full cursor-pointer border-red-500 text-red-500 hover:bg-red-500/10 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Log out
        </Button>
      </DialogContent>
    </Dialog>
  );
}
