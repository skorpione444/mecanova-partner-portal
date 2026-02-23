"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      router.push(user ? "/dashboard" : "/login");
    });
  }, [router, supabase]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--mc-black)" }}
    >
      <p className="text-xs" style={{ color: "var(--mc-cream-faint)" }}>
        Redirecting...
      </p>
    </div>
  );
}
