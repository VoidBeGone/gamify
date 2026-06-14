"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface CheckboxProps {
  checked: boolean;
  onCheck: () => void;
  /** If provided, clicking a checked checkbox calls this instead of doing nothing. */
  onUncheck?: () => void;
  disabled?: boolean;
  /** Accent color of the check fill (defaults to the global accent). */
  color?: string;
  label?: string;
  className?: string;
}

/** Lightweight animated checkbox (no Radix dependency). */
export function Checkbox({
  checked,
  onCheck,
  onUncheck,
  disabled,
  color,
  label,
  className,
}: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || (checked && !onUncheck)}
      onClick={checked ? onUncheck : onCheck}
      className={cn(
        "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
        checked ? "border-transparent" : "border-border hover:border-text-secondary",
        disabled && !checked && "opacity-50",
        className,
      )}
      style={checked ? { backgroundColor: color ?? "var(--color-accent)" } : undefined}
    >
      {checked && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
        >
          <Check className="h-3.5 w-3.5 text-black" strokeWidth={3} />
        </motion.span>
      )}
    </button>
  );
}
