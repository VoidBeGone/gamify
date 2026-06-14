"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Dumbbell,
  BookOpen,
  Compass,
  Trophy,
  CalendarDays,
  Settings,
  Menu,
  BarChart2,
  History,
  Flame,
} from "lucide-react";
import { useDashboardStore } from "@/store/useDashboardStore";
import { XpBar } from "@/components/dashboard/XpBar";
import { formatRank, rankProgress } from "@/lib/rank";
import { cn } from "@/lib/cn";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
  { label: "Goals", href: "/goals", icon: Target },
  { label: "Workout", href: "/workout", icon: Flame },
  { label: "Fitness", href: "/metrics/fitness", icon: Dumbbell },
  { label: "Content", href: "/metrics/content", icon: BookOpen },
  { label: "Side Quests", href: "/metrics/sidequests", icon: Compass },
  { label: "Progress", href: "/progress", icon: BarChart2 },
  { label: "History", href: "/history", icon: History },
  { label: "Achievements", href: "/achievements", icon: Trophy },
  { label: "Weekly Review", href: "/review", icon: CalendarDays },
  { label: "Settings", href: "/settings", icon: Settings },
];

function isActive(href: string, pathname: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const user = useDashboardStore((s) => s.user);
  const progress = user ? rankProgress(user.global_xp) : null;

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Wordmark + hamburger */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border px-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed && (
          <span className="font-display text-lg font-bold text-text-primary">
            LevelUp
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
            const active = isActive(href, pathname, exact);
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={collapsed ? label : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    collapsed && "justify-center",
                    active
                      ? "bg-accent/15 font-medium text-accent"
                      : "text-text-secondary hover:bg-surface-raised hover:text-text-primary",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Rank + XP bar */}
      {user && progress && (
        <div
          className={cn(
            "shrink-0 border-t border-border p-3",
            collapsed && "px-2",
          )}
        >
          {collapsed ? (
            <div
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent"
              title={formatRank(user.global_rank_name, user.global_rank_tier)}
            >
              <span className="text-xs font-bold tabular-nums">
                {user.global_rank_tier}
              </span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-text-secondary">Global Rank</p>
              <p className="truncate text-sm font-semibold text-text-primary">
                {formatRank(user.global_rank_name, user.global_rank_tier)}
              </p>
              <XpBar fraction={progress.fraction} glow className="h-1.5" />
              <p className="text-xs tabular-nums text-text-secondary">
                {user.global_xp.toLocaleString()} XP
              </p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
