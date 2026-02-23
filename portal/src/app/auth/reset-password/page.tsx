"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
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
            style={{ fontFamily: "var(--font-jost), Jost, sans-serif", color: "var(--mc-cream)" }}
          >
            Mecanova
          </h1>
          <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color: "var(--mc-cream-subtle)" }}>
            Reset Password
          </p>
        </div>

        {sent ? (
          <div
            className="px-4 py-3 text-xs text-center"
            style={{ background: "var(--mc-success-bg)", border: "1px solid var(--mc-success-light)", color: "var(--mc-success)" }}
          >
            Check your email for a password reset link.
          </div>
        ) : (
          <>
            {error && (
              <div
                className="mb-6 px-4 py-3 text-xs"
                style={{ background: "var(--mc-error-bg)", border: "1px solid var(--mc-error-light)", color: "var(--mc-error)" }}
              >
                {error}
              </div>
            )}
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <label className="mc-label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mc-input"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="mc-btn mc-btn-primary w-full" style={{ padding: "12px" }}>
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </>
        )}

        <p className="text-center mt-6">
          <a href="/login" className="text-[10px] tracking-wider uppercase" style={{ color: "var(--mc-cream-subtle)" }}>
            Back to login
          </a>
        </p>
      </div>
    </div>
  );
}
