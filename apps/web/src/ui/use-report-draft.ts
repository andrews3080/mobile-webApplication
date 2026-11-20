import { useCallback, useEffect, useRef, useState } from "react";
import { DraftStorageFullError } from "../core/errors";
import { newDraft } from "../core/report-draft";
import type { ReportDraft } from "../core/report-draft";
import type { ReportServices } from "./services";

export type SaveState = "idle" | "saving" | "saved" | "failed";

export interface DraftHandle {
  draft: ReportDraft | null; // null while the saved draft is still loading
  restored: boolean; // true when we picked up where the reporter left off
  saveState: SaveState;
  saveError: string | null;
  update(change: (draft: ReportDraft, now: Date) => ReportDraft): void;
  flush(): Promise<void>; // save NOW and stop any pending save
  reload(): Promise<void>; // read back what is stored (the submit step records uploaded photos there)
  startOver(): Promise<void>; // throw this draft away and begin a new one
}

export const DEFAULT_AUTOSAVE_MS = 500;

// Keeps the draft in React state AND on the device. Every change is saved shortly after typing stops,
// and straight away when the page is hidden (switching apps, locking the phone).
export function useReportDraft(services: ReportServices, autosaveMs = DEFAULT_AUTOSAVE_MS): DraftHandle {
  const { drafts, clock, ids } = services;
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [restored, setRestored] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const latest = useRef<ReportDraft | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(false);

  const show = useCallback((next: ReportDraft) => {
    latest.current = next;
    setDraft(next);
  }, []);

  const save = useCallback(
    async (toSave: ReportDraft) => {
      setSaveState("saving");
      try {
        await drafts.save(toSave);
        if (latest.current === toSave) dirty.current = false;
        setSaveState("saved");
        setSaveError(null);
      } catch (error) {
        setSaveState("failed");
        setSaveError(
          error instanceof DraftStorageFullError ? error.message : "Your report could not be saved on this device. Keep this page open.",
        );
      }
    },
    [drafts],
  );

  const cancelPending = () => {
    clearTimeout(pending.current);
    pending.current = undefined;
  };

  const flush = useCallback(async () => {
    cancelPending();
    if (latest.current && dirty.current) await save(latest.current);
  }, [save]);

  const update = useCallback(
    (change: (draft: ReportDraft, now: Date) => ReportDraft) => {
      if (!latest.current) return;
      show(change(latest.current, clock.now()));
      dirty.current = true;
      cancelPending();
      pending.current = setTimeout(() => {
        pending.current = undefined;
        if (latest.current) void save(latest.current);
      }, autosaveMs);
    },
    [autosaveMs, clock, save, show],
  );

  const fresh = useCallback(() => newDraft(ids.next(), ids.next(), clock.now()), [clock, ids]);

  const reload = useCallback(async () => {
    cancelPending();
    dirty.current = false;
    show((await drafts.load()) ?? fresh());
  }, [drafts, fresh, show]);

  const startOver = useCallback(async () => {
    cancelPending();
    dirty.current = false;
    await drafts.clear();
    setRestored(false);
    setSaveState("idle");
    show(fresh());
  }, [drafts, fresh, show]);

  // Load once on start
  useEffect(() => {
    let cancelled = false;
    drafts
      .load()
      .catch(() => null) // an unreadable store should not block a new report
      .then((saved) => {
        if (cancelled) return;
        setRestored(saved !== null);
        show(saved ?? fresh());
      });
    return () => {
      cancelled = true;
    };
  }, [drafts, fresh, show]);

  // Save at once when the reporter leaves the page, and on unmount
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  return { draft, restored, saveState, saveError, update, flush, reload, startOver };
}
