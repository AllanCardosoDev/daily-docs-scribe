import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutosaveOptions<T> {
  /** Async persister. Rejects propagate to `status = "error"`. */
  onSave: (value: T) => Promise<void> | void;
  /** Debounce window in ms. Defaults to 900ms. */
  debounceMs?: number;
  /** How long the "saved" badge should stay visible. Defaults to 1500ms. */
  savedDurationMs?: number;
}

interface UseAutosaveResult<T> {
  status: AutosaveStatus;
  errorMessage: string | null;
  /** Queue `value` for save; further calls before the debounce fire replace it. */
  scheduleSave: (value: T) => void;
  /** True while an edit is pending or in-flight. Use to skip prop syncing. */
  isDirtyRef: React.MutableRefObject<boolean>;
}

/**
 * Debounced autosave with idle / saving / saved / error status.
 * Extracts the pattern previously duplicated across DataTable + EditableHeader.
 *
 * - Cancels pending timers on unmount to avoid updates after unmount.
 * - `onSave` is captured through a ref so callers may pass fresh closures without resetting the debounce.
 */
export function useAutosave<T>({
  onSave,
  debounceMs = 900,
  savedDurationMs = 1500,
}: UseAutosaveOptions<T>): UseAutosaveResult<T> {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDirtyRef = useRef(false);
  const generationRef = useRef(0);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  const scheduleSave = useCallback(
    (value: T) => {
      isDirtyRef.current = true;
      const generation = ++generationRef.current;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          setStatus("saving");
          setErrorMessage(null);
          await onSaveRef.current(value);
          // Only clear the dirty flag when no newer edit arrived while saving,
          // otherwise prop syncing would stay blocked forever.
          if (generationRef.current === generation) isDirtyRef.current = false;
          setStatus("saved");
          if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
          resetTimerRef.current = setTimeout(
            () => setStatus((s) => (s === "saved" ? "idle" : s)),
            savedDurationMs,
          );
        } catch (e) {
          // Mantém o estado "sujo": a edição não foi persistida, então um
          // refresh do servidor não pode sobrescrever o que o usuário digitou.
          isDirtyRef.current = true;
          setStatus("error");
          setErrorMessage((e as Error)?.message ?? "Falha ao salvar");
        } finally {
          saveTimerRef.current = null;
        }
      }, debounceMs);
    },
    [debounceMs, savedDurationMs],
  );

  return { status, errorMessage, scheduleSave, isDirtyRef };
}
