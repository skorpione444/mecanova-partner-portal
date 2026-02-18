"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, ArrowRight } from "lucide-react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const reset = searchParams.get("reset");
    if (reset === "success") {
      setStatus({
        type: "success",
        message:
          "Password reset successful! You can now sign in with your new password.",
      });
      router.replace("/login");
    }
  }, [searchParams, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      router.push("/dashboard");
    }

    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "#0a0b0d" }}
    >
      {/* Subtle ambient glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.03]"
        style={{
          background:
            "radial-gradient(circle, #ecdfcc 0%, transparent 60%)",
        }}
      />

      <div className="w-full max-w-[400px] mx-6 mc-animate-page">
        {/* Brand */}
        <div className="text-center mb-14">
          <p
            className="text-[10px] font-medium tracking-[0.25em] uppercase mb-4"
            style={{
              fontFamily: "var(--font-manrope), Manrope, sans-serif",
              color: "#7D7468",
            }}
          >
            EST. 2024
          </p>
          <h1
            className="text-[2rem] font-light tracking-[0.3em] uppercase"
            style={{
              fontFamily: "var(--font-jost), Jost, sans-serif",
              color: "#ecdfcc",
            }}
          >
            MECANOVA
          </h1>
          <p
            className="mt-3 text-xs tracking-[0.15em] uppercase"
            style={{
              fontFamily: "var(--font-manrope), Manrope, sans-serif",
              color: "#5C5449",
            }}
          >
            Partner Portal
          </p>
        </div>

        {/* Login Card */}
        <div
          className="p-8"
          style={{
            background: "#1a1a1a",
            border: "1px solid #2A2A2A",
          }}
        >
          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="mc-label"
                style={{ color: "#A89F91" }}
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "#5C5449" }}
                  strokeWidth={1.5}
                />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="mc-input pl-10"
                  style={{
                    background: "#111111",
                    border: "1px solid #2A2A2A",
                    color: "#ecdfcc",
                  }}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mc-label"
                style={{ color: "#A89F91" }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "#5C5449" }}
                  strokeWidth={1.5}
                />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="mc-input pl-10"
                  style={{
                    background: "#111111",
                    border: "1px solid #2A2A2A",
                    color: "#ecdfcc",
                  }}
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mc-btn mc-btn-primary w-full justify-center py-3 text-sm font-medium tracking-[0.08em] uppercase"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-transparent animate-spin"
                    style={{ borderTopColor: "currentColor" }}
                  />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In
                  <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                </span>
              )}
            </button>
          </form>

          {status && (
            <div
              className="mt-5 p-3.5 text-sm mc-animate-fade"
              style={{
                background:
                  status.type === "success"
                    ? "rgba(107, 143, 110, 0.1)"
                    : "rgba(196, 90, 90, 0.1)",
                border: `1px solid ${
                  status.type === "success"
                    ? "rgba(107, 143, 110, 0.25)"
                    : "rgba(196, 90, 90, 0.25)"
                }`,
                color:
                  status.type === "success" ? "#6b8f6e" : "#c45a5a",
              }}
            >
              {status.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="mt-8 pt-6 text-center"
          style={{ borderTop: "1px solid #1a1a1a" }}
        >
          <p
            className="text-[10px] tracking-[0.15em] uppercase"
            style={{ color: "#3a3a3a" }}
          >
            Invite-only access for approved partners
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#0a0b0d" }}
        >
          <div
            className="w-6 h-6 border border-transparent animate-spin"
            style={{ borderTopColor: "#ecdfcc" }}
          />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
