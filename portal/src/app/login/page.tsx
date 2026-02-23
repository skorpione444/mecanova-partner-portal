"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--mc-black)" }}
    >
      <div className="w-full max-w-sm mc-animate-page">
        <div className="text-center mb-10">
          <h1
            className="text-sm font-light tracking-[0.3em] uppercase mb-2"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color: "var(--mc-cream)",
            }}
          >
            Mecanova
          </h1>
          <p
            className="text-[10px] tracking-[0.15em] uppercase"
            style={{ color: "var(--mc-cream-subtle)" }}
          >
            Partner Portal
          </p>
        </div>

        {error && (
          <div
            className="mb-6 px-4 py-3 text-xs"
            style={{
              background: "var(--mc-error-bg)",
              border: "1px solid var(--mc-error-light)",
              color: "var(--mc-error)",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="mc-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mc-input"
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="mc-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mc-input"
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mc-btn mc-btn-primary w-full"
            style={{ padding: "12px" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p
          className="text-center mt-8 text-[10px] tracking-wider uppercase"
          style={{ color: "var(--mc-cream-faint)" }}
        >
          Mecanova Partner Portal
        </p>
      </div>
    </div>
  );
}
