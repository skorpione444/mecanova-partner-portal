"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { UserRole } from "@/lib/supabase/types";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  ShoppingCart,
  FilePlus,
  FileText,
  LogOut,
  Menu,
  X,
} from "lucide-react";

interface PortalShellProps {
  children: React.ReactNode;
}

interface UserProfile {
  role: UserRole;
  partner_id: string | null;
  full_name: string | null;
}

const NAV_ICONS: Record<string, React.ElementType> = {
  "/dashboard": LayoutDashboard,
  "/products": Package,
  "/orders": ClipboardList,
  "/my-orders": ShoppingCart,
  "/orders/new": FilePlus,
  "/documents": FileText,
};

export default function PortalShell({ children }: PortalShellProps) {
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const loadSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email || null);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, partner_id, full_name")
        .eq("user_id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      setLoading(false);
    };

    loadSession();
  }, [router, supabase]);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }, [supabase, router]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#111111" }}
      >
        <div className="flex flex-col items-center gap-4 mc-animate-fade">
          <div
            className="w-6 h-6 border border-transparent animate-spin"
            style={{ borderTopColor: "#ecdfcc" }}
          />
          <p
            className="text-xs tracking-[0.1em] uppercase"
            style={{
              fontFamily: "var(--font-manrope), Manrope, sans-serif",
              color: "#5C5449",
            }}
          >
            Loading…
          </p>
        </div>
      </div>
    );
  }

  // Build navigation based on role
  const navItems: { href: string; label: string }[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/products", label: "Products" },
  ];

  if (profile?.role === "distributor" || profile?.role === "admin") {
    navItems.push({ href: "/orders", label: "Orders" });
  }

  if (profile?.role === "client" || profile?.role === "admin") {
    navItems.push({ href: "/my-orders", label: "My Orders" });
  }

  if (profile?.role === "client" || profile?.role === "admin") {
    navItems.push({ href: "/orders/new", label: "New Order" });
  }

  navItems.push({ href: "/documents", label: "Documents" });

  const isActive = (href: string) => {
    if (
      href === "/orders" &&
      pathname?.startsWith("/orders") &&
      !pathname?.startsWith("/orders/new")
    ) {
      return (
        pathname === "/orders" ||
        pathname?.match(/^\/orders\/[^/]+$/) !== null
      );
    }
    if (href === "/my-orders") {
      return pathname?.startsWith("/my-orders") || false;
    }
    return pathname === href;
  };

  const displayName = profile?.full_name || email || "User";
  const initials = (profile?.full_name || email || "U")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  const roleLabel =
    profile?.role === "distributor"
      ? "Distributor"
      : profile?.role === "client"
      ? "Buyer"
      : profile?.role === "admin"
      ? "Admin"
      : "Partner";

  return (
    <div className="min-h-screen" style={{ background: "#111111" }}>
      {/* Mobile top bar */}
      <div
        className="lg:hidden flex items-center justify-between px-5 py-4"
        style={{
          background: "#0a0b0d",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 transition-colors"
          style={{ color: "#A89F91" }}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? (
            <X className="w-5 h-5" strokeWidth={1.5} />
          ) : (
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          )}
        </button>
        <span
          className="text-sm font-light tracking-[0.2em] uppercase"
          style={{
            fontFamily: "var(--font-jost), Jost, sans-serif",
            color: "#ecdfcc",
          }}
        >
          Mecanova
        </span>
        <div className="w-8" />
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 transition-opacity"
          style={{ background: "rgba(10, 11, 13, 0.8)" }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 w-[240px] h-screen transform ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          } transition-transform duration-300 ease-in-out`}
          style={{
            background: "#0a0b0d",
            borderRight: "1px solid #1a1a1a",
          }}
        >
          <div className="h-full flex flex-col">
            {/* Brand */}
            <div
              className="px-6 py-6"
              style={{ borderBottom: "1px solid #1a1a1a" }}
            >
              <div>
                <h1
                  className="text-sm font-light tracking-[0.25em] uppercase"
                  style={{
                    fontFamily: "var(--font-jost), Jost, sans-serif",
                    color: "#ecdfcc",
                  }}
                >
                  Mecanova
                </h1>
                <p
                  className="text-[9px] tracking-[0.15em] uppercase mt-1"
                  style={{ color: "#5C5449" }}
                >
                  Partner Portal
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = NAV_ICONS[item.href] || FileText;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className="group flex items-center gap-3 px-3 py-2.5 text-[13px] transition-all duration-200 relative"
                    style={{
                      background: active ? "#1a1a1a" : "transparent",
                      color: active ? "#ecdfcc" : "#7D7468",
                      borderLeft: active
                        ? "2px solid #ecdfcc"
                        : "2px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = "#cdc9c2";
                        e.currentTarget.style.background = "#111111";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.color = "#7D7468";
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <Icon
                      className="w-[16px] h-[16px] flex-shrink-0"
                      strokeWidth={active ? 2 : 1.5}
                    />
                    <span
                      className="font-medium tracking-wide"
                      style={{
                        fontFamily: "var(--font-manrope), Manrope, sans-serif",
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>

            {/* User section */}
            <div
              className="px-4 py-4"
              style={{ borderTop: "1px solid #1a1a1a" }}
            >
              <div className="flex items-center gap-3 px-2 mb-3">
                {/* Avatar */}
                <div
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0 text-[10px] font-semibold tracking-wider"
                  style={{
                    background: "#1a1a1a",
                    color: "#A89F91",
                    border: "1px solid #2A2A2A",
                  }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium truncate"
                    style={{ color: "#cdc9c2" }}
                  >
                    {displayName}
                  </p>
                  <p
                    className="text-[10px] truncate tracking-wide uppercase"
                    style={{ color: "#5C5449" }}
                  >
                    {roleLabel}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-xs transition-all duration-200 tracking-wide"
                style={{
                  color: "#7D7468",
                  fontFamily: "var(--font-manrope), Manrope, sans-serif",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#111111";
                  e.currentTarget.style.color = "#c45a5a";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#7D7468";
                }}
              >
                <LogOut className="w-[15px] h-[15px]" strokeWidth={1.5} />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 min-h-screen">
          <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8 lg:py-10">
            <div className="mc-animate-page">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
