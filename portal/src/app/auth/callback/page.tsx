"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type Status = { type: "loading" | "error" | "success"; message: string };

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<Status>({
    type: "loading",
    message: "Processing authentication…",
  });
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleCallback = async () => {
      if (!window.location.hash || window.location.hash.length < 10) {
        setStatus({
          type: "error",
          message:
            "No authentication tokens found. Please use the link from your email.",
        });
        setTimeout(() => router.push("/login"), 3000);
        return;
      }

      const hashParams = new URLSearchParams(
        window.location.hash.substring(1)
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");
      const error = hashParams.get("error");
      const errorDescription = hashParams.get("error_description");

      if (error) {
        setStatus({
          type: "error",
          message: errorDescription || "Authentication failed.",
        });
        setTimeout(() => router.push("/login"), 3000);
        return;
      }

      if (!accessToken || !refreshToken) {
        setStatus({
          type: "error",
          message: "Invalid authentication link.",
        });
        setTimeout(() => router.push("/login"), 3000);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        setStatus({
          type: "error",
          message: `Session error: ${sessionError.message}`,
        });
        setTimeout(() => router.push("/login"), 3000);
        return;
      }

      window.history.replaceState(null, "", window.location.pathname);

      if (type === "recovery") {
        setStatus({
          type: "success",
          message: "Redirecting to password reset…",
        });
        router.push("/auth/reset-password");
      } else {
        setStatus({ type: "success", message: "Redirecting to dashboard…" });
        router.push("/dashboard");
      }
    };

    handleCallback();
  }, [router, supabase.auth]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: "var(--mc-background)",
      }}
    >
      <div
        className="w-full max-w-sm mx-4 p-8 text-center mc-animate-page"
        style={{
          background: "var(--mc-card)",
          border: "1px solid var(--mc-border)",
          boxShadow: "var(--mc-shadow-md)",
        }}
      >
        {status.type === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-10 h-10 border-2 border-transparent rounded-full animate-spin"
              style={{ borderTopColor: "var(--mc-foreground)" }}
            />
            <p className="text-sm" style={{ color: "var(--mc-muted-foreground)" }}>
              {status.message}
            </p>
          </div>
        )}
        {status.type === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-12 h-12 flex items-center justify-center"
              style={{ background: "var(--mc-error-bg)" }}
            >
              <AlertCircle
                className="w-6 h-6"
                style={{ color: "var(--mc-error)" }}
                strokeWidth={1.5}
              />
            </div>
            <div>
              <p
                className="text-sm font-medium mb-1"
                style={{ color: "var(--mc-error)" }}
              >
                Authentication Error
              </p>
              <p className="text-sm" style={{ color: "var(--mc-muted-foreground)" }}>
                {status.message}
              </p>
            </div>
            <p
              className="text-xs"
              style={{ color: "var(--mc-text-muted)" }}
            >
              Redirecting to login…
            </p>
          </div>
        )}
        {status.type === "success" && (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-12 h-12 flex items-center justify-center"
              style={{ background: "var(--mc-success-bg)" }}
            >
              <CheckCircle2
                className="w-6 h-6"
                style={{ color: "var(--mc-success)" }}
                strokeWidth={1.5}
              />
            </div>
            <p className="text-sm" style={{ color: "var(--mc-success)" }}>
              {status.message}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
