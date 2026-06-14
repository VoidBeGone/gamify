"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  Activity,
  Trophy,
  BarChart2,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface MobileNavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  matchPrefix?: string;
}

const MOBILE_ITEMS: MobileNavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
  { label: "Goals", href: "/goals", icon: Target },
  {
    label: "Metrics",
    href: "/metrics/fitness",
    icon: Activity,
    matchPrefix: "/metrics",
  },
  { label: "Progress", href: "/progress", icon: BarChart2 },
  { label: "Achievements", href: "/achievements", icon: Trophy },
];

function isActive(
  href: string,
  pathname: string,
  exact?: boolean,
  matchPrefix?: string,
): boolean {
  if (exact) return pathname === href;
  if (matchPrefix) return pathname.startsWith(matchPrefix);
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-surface/95 backdrop-blur-sm md:hidden">
      {MOBILE_ITEMS.map(({ label, href, icon: Icon, exact, matchPrefix }) => {
        const active = isActive(href, pathname, exact, matchPrefix);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-xs transition-colors",
              active
                ? "text-accent"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
