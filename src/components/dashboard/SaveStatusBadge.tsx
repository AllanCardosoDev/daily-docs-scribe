import { memo } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import type { AutosaveStatus } from "@/hooks/use-autosave";

interface Props {
  status: AutosaveStatus;
  errorMessage?: string | null;
  /** Max width for the error message text; defaults to `200px`. */
  errorMaxWidth?: string;
}

/**
 * Pill shown next to editable cards while an autosave debounce cycle runs.
 * Same visual states previously duplicated in DataTable + EditableHeader.
 */
export const SaveStatusBadge = memo(function SaveStatusBadge({
  status,
  errorMessage,
  errorMaxWidth = "200px",
}: Props) {
  if (status === "idle") return <div className="min-h-6" />;
  return (
    <div
      className="text-xs flex items-center gap-1.5 min-h-6 shrink-0 transition-all"
      role="status"
      aria-live="polite"
    >
      {status === "saving" && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 text-sky-700 px-2 py-0.5 border border-sky-100">
          <Loader2 className="w-3 h-3 animate-spin" /> Salvando…
        </span>
      )}
      {status === "saved" && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 border border-emerald-100 animate-fade-in-soft">
          <Check className="w-3 h-3" /> Salvo
        </span>
      )}
      {status === "error" && (
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-700 px-2 py-0.5 border border-red-100"
          style={{ maxWidth: errorMaxWidth }}
        >
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </span>
      )}
    </div>
  );
});
