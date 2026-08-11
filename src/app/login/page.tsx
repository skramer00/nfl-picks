"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

const AUTH_TIMEOUT_MS = 15_000;
type AuthMode = "login" | "signup" | "forgot" | "reset";

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function withAuthTimeout<T>(request: PromiseLike<T>): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("The request timed out. Check your connection and try again."));
    }, AUTH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([Promise.resolve(request), timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function destinationAfterAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "/week/1";
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.onboarding_completed_at ? "/week/1" : "/onboarding";
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const requestedNext = searchParams.get("next");
  const safeNext = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : null;
  const [mode, setMode] = useState<AuthMode>(
    requestedMode === "signup" || requestedMode === "reset"
      ? requestedMode
      : "login"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);

    try {
      const { error } = await withAuthTimeout(
        supabase.auth.signInWithPassword({ email, password })
      );
      if (error) throw error;
      router.push(safeNext ?? await destinationAfterAuth());
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
      const { data, error } = await withAuthTimeout(
        supabase.auth.signUp({ email, password })
      );
      if (error) throw error;

      if (data.session) {
        router.push(safeNext ?? "/onboarding");
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

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);

    try {
      const { error } = await withAuthTimeout(
        supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?mode=reset`,
        })
      );
      if (error) throw error;
      setStatus("If an account exists for that email, a password-reset link is on its way.");
    } catch (error) {
      setStatus(`Reset request failed: ${messageFrom(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setIsLoading(true);

    try {
      const { error } = await withAuthTimeout(
        supabase.auth.updateUser({ password })
      );
      if (error) throw error;
      setStatus("Password updated. Taking you to your picks…");
      router.push("/week/1");
      router.refresh();
    } catch (error) {
      setStatus(`Password update failed: ${messageFrom(error)}`);
    } finally {
      setIsLoading(false);
    }
  }

  if (mode === "forgot" || mode === "reset") {
    const resetting = mode === "reset";
    return (
      <main className="mx-auto max-w-md p-6">
        <h1 className="text-3xl font-semibold">
          {resetting ? "Choose a new password" : "Reset your password"}
        </h1>
        <p className="mt-2 text-sm text-gray-400">
          {resetting
            ? "Enter a new password for your Pretzel Quest account."
            : "We’ll email you a secure link to choose a new password."}
        </p>
        {status ? (
          <div className="mt-5 rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm text-gray-200" role="status">
            {status}
          </div>
        ) : null}
        <form
          className="mt-6 space-y-4"
          onSubmit={resetting ? handlePasswordReset : handleForgotPassword}
        >
          {resetting ? (
            <label className="block text-sm text-gray-300">
              New password
              <input
                required
                minLength={8}
                type="password"
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 p-3 text-white"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
          ) : (
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
          )}
          <button
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            type="submit"
          >
            {isLoading ? "Working…" : resetting ? "Update password" : "Send reset link"}
          </button>
        </form>
        {!resetting ? (
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setStatus("");
            }}
            className="mt-5 text-sm text-gray-400 hover:text-white"
          >
            ← Back to login
          </button>
        ) : null}
      </main>
    );
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
        {mode === "login" ? (
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setStatus("");
            }}
            className="w-full text-sm text-gray-400 hover:text-white"
          >
            Forgot password?
          </button>
        ) : null}
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
