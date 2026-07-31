"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function LoginPage() {
  const router = useRouter();
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

  async function handleSignup() {
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
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm text-gray-400">Log in or create an account to save your picks.</p>

      {status && (
        <div className="mt-5 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-200" role="status">
          {status}
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={handleLogin}>
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
            autoComplete="current-password"
          />
        </label>

        <div className="flex gap-3">
          <button disabled={isLoading} className="flex-1 rounded-lg bg-gray-800 py-2 hover:bg-gray-700 disabled:opacity-50" type="submit">
            {isLoading ? "Working…" : "Log in"}
          </button>
          <button disabled={isLoading} className="flex-1 rounded-lg bg-blue-600 py-2 hover:bg-blue-500 disabled:opacity-50" onClick={handleSignup} type="button">
            {isLoading ? "Working…" : "Sign up"}
          </button>
        </div>
      </form>
    </main>
  );
}
