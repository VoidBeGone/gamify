"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "← Dashboard", color: null },
  { href: "/metrics/fitness", label: "Fitness", color: "text-fitness" },
  { href: "/metrics/content", label: "Content", color: "text-content" },
  { href: "/metrics/sidequests", label: "Side Quests", color: "text-sidequest" },
];

export function MetricsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-2 pb-1">
      {LINKS.map(({ href, label, color }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? cn("border border-border bg-surface-raised", color ?? "text-text-primary")
                : "text-text-secondary hover:bg-surface-raised hover:text-text-primary",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
