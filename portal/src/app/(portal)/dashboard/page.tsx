"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import StatCard from "@/components/StatCard";
import type { UserRole } from "@/lib/supabase/types";
import {
  Package,
  FileText,
  Inbox,
  CheckCircle2,
  History,
  ShoppingCart,
  ListOrdered,
  Shield,
} from "lucide-react";

interface UserProfile {
  role: UserRole;
  partner_id: string | null;
  full_name: string | null;
}

interface Stats {
  totalProducts: number;
  activeDocuments: number;
  incomingOrders: number;
  acceptedOrders: number;
  orderHistory: number;
  myOpenOrders: number;
  myTotalOrders: number;
}

const EMPTY_STATS: Stats = {
  totalProducts: 0,
  activeDocuments: 0,
  incomingOrders: 0,
  acceptedOrders: 0,
  orderHistory: 0,
  myOpenOrders: 0,
  myTotalOrders: 0,
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("role, partner_id, full_name")
        .eq("user_id", user.id)
        .single();

      if (!profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const [productsRes, docsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("active", true),
        supabase.from("documents").select("id", { count: "exact", head: true }),
      ]);

      const next: Stats = {
        ...EMPTY_STATS,
        totalProducts: productsRes.count || 0,
        activeDocuments: docsRes.count || 0,
      };

      if (profileData.role === "distributor" && profileData.partner_id) {
        const pid = profileData.partner_id;
        const [incoming, accepted, history] = await Promise.all([
          supabase
            .from("order_requests")
            .select("id", { count: "exact", head: true })
            .eq("distributor_id", pid)
            .eq("status", "submitted"),
          supabase
            .from("order_requests")
            .select("id", { count: "exact", head: true })
            .eq("distributor_id", pid)
            .eq("status", "accepted"),
          supabase
            .from("order_requests")
            .select("id", { count: "exact", head: true })
            .eq("distributor_id", pid)
            .in("status", ["fulfilled", "rejected", "cancelled"]),
        ]);
        next.incomingOrders = incoming.count || 0;
        next.acceptedOrders = accepted.count || 0;
        next.orderHistory = history.count || 0;
      }

      if (profileData.role === "client" && profileData.partner_id) {
        const pid = profileData.partner_id;
        const [openOrders, totalOrders] = await Promise.all([
          supabase
            .from("order_requests")
            .select("id", { count: "exact", head: true })
            .eq("client_id", pid)
            .in("status", ["created", "submitted", "accepted"]),
          supabase
            .from("order_requests")
            .select("id", { count: "exact", head: true })
            .eq("client_id", pid),
        ]);
        next.myOpenOrders = openOrders.count || 0;
        next.myTotalOrders = totalOrders.count || 0;
      }

      setStats(next);
      setLoading(false);
    };

    load();
  }, [supabase]);

  if (loading) {
    return (
      <div className="space-y-8">
        {/* Skeleton header */}
        <div>
          <div className="mc-skeleton h-8 w-48 mb-3" />
          <div className="mc-skeleton h-5 w-72" />
        </div>
        {/* Skeleton cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="mc-card p-6">
              <div className="mc-skeleton h-4 w-24 mb-4" />
              <div className="mc-skeleton h-9 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div
        className="mc-card p-6 flex items-center gap-3"
        style={{
          background: "var(--mc-warning-bg)",
          borderColor: "var(--mc-warning)",
        }}
      >
        <Shield
          className="w-5 h-5 flex-shrink-0"
          style={{ color: "var(--mc-warning)" }}
          strokeWidth={1.5}
        />
        <p className="text-sm" style={{ color: "var(--mc-warning)" }}>
          Profile not found. Please contact your Mecanova administrator.
        </p>
      </div>
    );
  }

  const greeting = profile.full_name
    ? `Welcome back, ${profile.full_name}`
    : "Welcome back";

  const now = new Date();
  const hour = now.getHours();
  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <p
          className="text-sm font-medium mb-1"
          style={{
            color: "var(--mc-foreground)",
            fontFamily: "var(--font-manrope), sans-serif",
            letterSpacing: "0.02em",
          }}
        >
          {timeGreeting}
        </p>
        <h1
          className="text-3xl lg:text-4xl font-semibold tracking-tight"
          style={{
            fontFamily: "var(--font-jost), sans-serif",
            color: "var(--mc-text-primary)",
          }}
        >
          {greeting}
        </h1>
        <p
          className="mt-2 text-sm"
          style={{
            color: "var(--mc-text-tertiary)",
            fontFamily: "var(--font-manrope), sans-serif",
          }}
        >
          Here&apos;s an overview of your operations
        </p>
      </div>

      {/* Distributor dashboard */}
      {profile.role === "distributor" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mc-stagger">
          <StatCard
            title="Products"
            value={stats.totalProducts}
            loading={loading}
            icon={Package}
          />
          <StatCard
            title="Documents"
            value={stats.activeDocuments}
            loading={loading}
            icon={FileText}
          />
          <StatCard
            title="Incoming"
            value={stats.incomingOrders}
            loading={loading}
            icon={Inbox}
            accent
          />
          <StatCard
            title="Accepted"
            value={stats.acceptedOrders}
            loading={loading}
            icon={CheckCircle2}
          />
          <StatCard
            title="History"
            value={stats.orderHistory}
            loading={loading}
            icon={History}
          />
        </div>
      )}

      {/* Buyer dashboard */}
      {profile.role === "client" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mc-stagger">
          <StatCard
            title="Products"
            value={stats.totalProducts}
            loading={loading}
            icon={Package}
          />
          <StatCard
            title="Documents"
            value={stats.activeDocuments}
            loading={loading}
            icon={FileText}
          />
          <StatCard
            title="Open Orders"
            value={stats.myOpenOrders}
            loading={loading}
            icon={ShoppingCart}
            accent
          />
          <StatCard
            title="Total Orders"
            value={stats.myTotalOrders}
            loading={loading}
            icon={ListOrdered}
          />
        </div>
      )}

      {/* Admin dashboard */}
      {profile.role === "admin" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mc-stagger">
          <StatCard
            title="Products"
            value={stats.totalProducts}
            loading={loading}
            icon={Package}
          />
          <StatCard
            title="Documents"
            value={stats.activeDocuments}
            loading={loading}
            icon={FileText}
          />
          <StatCard
            title="Admin"
            value="—"
            loading={false}
            icon={Shield}
          />
        </div>
      )}
    </div>
  );
}
