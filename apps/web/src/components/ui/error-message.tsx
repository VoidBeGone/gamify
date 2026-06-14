import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-debuff-critical/40 bg-debuff-critical/10 p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-debuff-critical" />
      <p className="flex-1 text-sm text-debuff-critical">{message}</p>
      {onRetry && (
        <Button
          size="sm"
          variant="secondary"
          onClick={onRetry}
          className="shrink-0"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </Button>
      )}
    </div>
  );
}
