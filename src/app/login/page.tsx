"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">(
    searchParams.get("mode") === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/week/1");
      router.refresh();
    } catch (error) {
      setStatus(`Login failed: ${messageFrom(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      if (data.session) {
        router.push("/profile");
        router.refresh();
      } else {
        setStatus("Account created. Check your email to confirm your address, then log in.");
      }
    } catch (error) {
      setStatus(`Sign up failed: ${messageFrom(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-3xl font-semibold">
        {mode === "signup" ? "Join Pretzel Quest" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-gray-400">
        {mode === "signup"
          ? "Create an account to save your picks and track your season."
          : "Log in to make picks and continue your season."}
      </p>

      <div className="mt-6 grid grid-cols-2 rounded-xl border border-gray-800 bg-gray-950 p-1" aria-label="Account action">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setStatus("");
          }}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium ${mode === "login" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white"}`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setStatus("");
          }}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium ${mode === "signup" ? "bg-amber-400 text-gray-950" : "text-gray-400 hover:text-white"}`}
        >
          Sign up
        </button>
      </div>

      {status && (
        <div className="mt-5 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-200" role="status">
          {status}
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={mode === "signup" ? handleSignup : handleLogin}>
        <label className="block text-sm text-gray-300">
          Email
          <input
            required
            type="email"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 text-white"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="block text-sm text-gray-300">
          Password
          <input
            required
            minLength={6}
            type="password"
            className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 text-white"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
        </label>

        <button
          disabled={isLoading}
          className={`w-full rounded-lg py-3 font-semibold disabled:opacity-50 ${mode === "signup" ? "bg-amber-400 text-gray-950 hover:bg-amber-300" : "bg-blue-600 text-white hover:bg-blue-500"}`}
          type="submit"
        >
          {isLoading ? "Working…" : mode === "signup" ? "Create account" : "Log in"}
        </button>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md p-6 text-gray-400">Loading…</main>}>
      <AuthForm />
    </Suspense>
  );
}
