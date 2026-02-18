"use client";

import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Lock, KeyRound, ArrowLeft } from "lucide-react";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setStatus({
          type: "error",
          message:
            "No active reset session. Please use the password reset link from your email.",
        });
      } else {
        setSessionReady(true);
      }
      setInitializing(false);
    };
    checkSession();
  }, [supabase.auth]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setStatus({
        type: "error",
        message: "Password must be at least 8 characters.",
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus({ type: "error", message: error.message });
    } else {
      await supabase.auth.signOut();
      router.push("/login?reset=success");
    }

    setLoading(false);
  };

  if (initializing) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--mc-background)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 border-transparent rounded-full animate-spin"
            style={{ borderTopColor: "var(--mc-foreground)" }}
          />
          <p className="text-sm" style={{ color: "var(--mc-text-muted)" }}>
            Verifying reset link…
          </p>
        </div>
      </div>
    );
  }

  if (!sessionReady && status?.type === "error") {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--mc-background)" }}
      >
        <div
          className="w-full max-w-[420px] mx-4 p-8 mc-animate-page"
          style={{
            background: "var(--mc-card)",
            border: "1px solid var(--mc-border)",
            boxShadow: "var(--mc-shadow-md)",
          }}
        >
          <h1
            className="text-xl font-semibold mb-5 text-center"
            style={{
              fontFamily: "var(--font-jost), sans-serif",
              color: "var(--mc-foreground)",
            }}
          >
            Reset Password
          </h1>
          <div
            className="p-3.5 text-sm mb-5"
            style={{
              background: "var(--mc-error-bg)",
              border: "1px solid var(--mc-error)",
              color: "var(--mc-error)",
            }}
          >
            {status.message}
          </div>
          <button
            onClick={() => router.push("/login")}
            className="mc-btn mc-btn-amber w-full justify-center py-3 gap-2"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--mc-background)" }}
    >
      <div className="w-full max-w-[420px] mx-4 mc-animate-page">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 mb-5"
            style={{
              background: "var(--mc-foreground)",
            }}
          >
            <KeyRound className="w-7 h-7" style={{ color: "var(--mc-background)" }} strokeWidth={1.5} />
          </div>
          <h1
            className="text-2xl font-semibold"
            style={{
              fontFamily: "var(--font-jost), sans-serif",
              color: "var(--mc-foreground)",
            }}
          >
            Set New Password
          </h1>
        </div>

        <div
          className="p-8"
          style={{
            background: "var(--mc-card)",
            border: "1px solid var(--mc-border)",
            boxShadow: "var(--mc-shadow-md)",
          }}
        >
          <form onSubmit={handleReset} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="mc-label"
                style={{ color: "var(--mc-muted-foreground)" }}
              >
                New Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--mc-text-muted)" }}
                  strokeWidth={1.5}
                />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="mc-input pl-10"
                  style={{
                    background: "var(--mc-input)",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-foreground)",
                  }}
                  placeholder="Min. 8 characters"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="confirmPassword"
                className="mc-label"
                style={{ color: "var(--mc-muted-foreground)" }}
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "var(--mc-text-muted)" }}
                  strokeWidth={1.5}
                />
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="mc-input pl-10"
                  style={{
                    background: "var(--mc-input)",
                    border: "1px solid var(--mc-border)",
                    color: "var(--mc-foreground)",
                  }}
                  placeholder="Repeat password"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mc-btn mc-btn-amber w-full justify-center py-3 text-sm font-semibold"
            >
              {loading ? "Updating…" : "Update Password"}
            </button>
          </form>

          {status && (
            <div
              className="mt-5 p-3.5 text-sm mc-animate-fade"
              style={{
                background:
                  status.type === "success"
                    ? "var(--mc-success-bg)"
                    : "var(--mc-error-bg)",
                border: `1px solid ${
                  status.type === "success"
                    ? "var(--mc-success)"
                    : "var(--mc-error)"
                }`,
                color:
                  status.type === "success" ? "var(--mc-success)" : "var(--mc-error)",
              }}
            >
              {status.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{
            background: "var(--mc-background)",
          }}
        >
          <div
            className="w-8 h-8 border-2 border-transparent rounded-full animate-spin"
            style={{ borderTopColor: "var(--mc-foreground)" }}
          />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
