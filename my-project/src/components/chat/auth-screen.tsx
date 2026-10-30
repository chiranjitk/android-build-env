"use client";

// Login / register screen for Adda.

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, LockKeyhole, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chatApi, setAuth } from "@/lib/chat-api";
import type { Me } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

interface AuthScreenProps {
  onAuthed: (token: string, me: Me) => void;
}

const STEPS = [
  "Create an account or log in with your username",
  "Chat with anyone on this server in real time",
  "Send texts, photos and voice notes — instantly",
];

export function AuthScreen({ onAuthed }: AuthScreenProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (username.trim().length < 3) return "Username must be at least 3 characters.";
    if (password.length < 4) return "Password must be at least 4 characters.";
    if (tab === "register" && displayName.trim().length < 1)
      return "Please enter a display name.";
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result =
        tab === "login"
          ? await chatApi.login({
              username: username.trim(),
              password,
            })
          : await chatApi.register({
              username: username.trim(),
              password,
              displayName: displayName.trim(),
            });
      setAuth(result.token, result.user);
      toast.success(tab === "login" ? "Welcome back!" : "Account created. Welcome to Adda!");
      onAuthed(result.token, result.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (value: string) => {
    setTab(value === "register" ? "register" : "login");
    setError(null);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f0f2f5] dark:bg-[#0b141a]">
      <div className="h-[210px] w-full bg-[#00a884] dark:bg-[#1f2c33]" aria-hidden="true" />

      <motion.main
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="mx-auto -mt-[150px] flex w-full max-w-4xl flex-1 flex-col px-4"
      >
        <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-start">
          {/* Left: pitch */}
          <section className="rounded-lg bg-white p-8 shadow-sm dark:bg-[#202c33] md:bg-transparent md:p-2 md:shadow-none md:dark:bg-transparent">
            <div className="mb-5 flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00a884]">
                <MessageCircle className="h-6 w-6 text-white" aria-hidden="true" />
              </span>
              <h1 className="text-2xl font-light text-[#41525d] dark:text-[#e9edef]">
                Use Adda on your computer
              </h1>
            </div>
            <ol className="space-y-3 text-sm text-[#667781] dark:text-[#8696a0]">
              {STEPS.map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00a884]/15 text-[11px] font-semibold text-[#008069] dark:text-[#25d366]">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>

          {/* Right: form card */}
          <section
            aria-label="Login or register"
            className="rounded-lg bg-white p-6 shadow-md dark:bg-[#202c33]"
          >
            <Tabs value={tab} onValueChange={handleTabChange}>
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit} noValidate>
                <TabsContent value="login" className="mt-0 space-y-4">
                  <CredentialsFields
                    username={username}
                    onUsername={setUsername}
                    password={password}
                    onPassword={setPassword}
                  />
                  <SubmitButton loading={loading} label="Log in" />
                </TabsContent>

                <TabsContent value="register" className="mt-0 space-y-4">
                  <div>
                    <label
                      htmlFor="adda-display-name"
                      className="mb-1 block text-xs font-medium text-[#667781] dark:text-[#8696a0]"
                    >
                      Display name
                    </label>
                    <Input
                      id="adda-display-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Riya Chatterjee"
                      autoComplete="name"
                      maxLength={50}
                    />
                  </div>
                  <CredentialsFields
                    username={username}
                    onUsername={setUsername}
                    password={password}
                    onPassword={setPassword}
                  />
                  <SubmitButton loading={loading} label="Create account" />
                </TabsContent>
              </form>
            </Tabs>

            {error && (
              <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
          </section>
        </div>
      </motion.main>

      <footer className="mt-auto px-4 py-5 text-center text-xs text-[#667781] dark:text-[#8696a0]">
        <span aria-hidden="true">🔒</span> Your personal private chat • End-to-end simple
      </footer>
    </div>
  );
}

function CredentialsFields(props: {
  username: string;
  onUsername: (v: string) => void;
  password: string;
  onPassword: (v: string) => void;
}) {
  return (
    <>
      <div>
        <label
          htmlFor="adda-username"
          className="mb-1 block text-xs font-medium text-[#667781] dark:text-[#8696a0]"
        >
          Username
        </label>
        <Input
          id="adda-username"
          value={props.username}
          onChange={(e) => props.onUsername(e.target.value)}
          placeholder="yourname"
          autoComplete="username"
          autoCapitalize="none"
          maxLength={30}
        />
      </div>
      <div>
        <label
          htmlFor="adda-password"
          className="mb-1 block text-xs font-medium text-[#667781] dark:text-[#8696a0]"
        >
          Password
        </label>
        <Input
          id="adda-password"
          type="password"
          value={props.password}
          onChange={(e) => props.onPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete={props.username ? "current-password" : "new-password"}
        />
      </div>
    </>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <Button
      type="submit"
      disabled={loading}
      className={cn(
        "h-10 w-full cursor-pointer bg-[#00a884] text-white hover:bg-[#017561]",
        "focus-visible:ring-[#00a884]"
      )}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Please wait…
        </>
      ) : (
        <>
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          {label}
        </>
      )}
    </Button>
  );
}
