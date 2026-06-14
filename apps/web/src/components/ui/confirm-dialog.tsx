"use client";

import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 font-display text-base font-semibold text-text-primary">
          {title}
        </h2>
        {description && (
          <p className="mb-5 text-sm text-text-secondary">{description}</p>
        )}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className={
              destructive
                ? "flex-1 border-debuff-critical/40 bg-debuff-critical text-white hover:bg-debuff-critical/90"
                : "flex-1"
            }
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
