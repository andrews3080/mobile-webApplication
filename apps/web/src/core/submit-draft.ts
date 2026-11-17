import { DraftInvalidError } from "./errors";
import type { Clock, DraftStore, PhotoUploadApi, ReportSubmitApi, Sleeper, SubmitReceipt } from "./ports";
import type { DraftPhoto, ReportDraft } from "./report-draft";
import { withRetry } from "./retry";
import { toSubmitRequest } from "./to-request";
import { validateDraft } from "./validate-draft";

export interface RetryPolicy {
  attempts: number;
  baseDelayMs: number;
}

// Sends a draft: photos first, then the report. Built to survive a bad connection:
//  - every network step is retried with backoff
//  - each uploaded photo is remembered in the draft, so a retry never uploads it twice
//  - the report is sent with the draft's idempotency key, so a retry never creates a second report
//  - the draft is deleted ONLY after the server confirmed the report
export class SubmitDraft {
  constructor(
    private readonly drafts: DraftStore,
    private readonly photos: PhotoUploadApi,
    private readonly reports: ReportSubmitApi,
    private readonly clock: Clock,
    private readonly sleeper: Sleeper,
    private readonly retry: RetryPolicy = { attempts: 4, baseDelayMs: 1000 },
  ) {}

  async execute(draft: ReportDraft): Promise<SubmitReceipt> {
    // Nothing goes over the network until the draft is valid
    const problems = validateDraft(draft, this.clock.now());
    if (Object.keys(problems).length > 0) throw new DraftInvalidError(problems);

    let current = draft;

    for (const photo of draft.photos) {
      if (photo.uploadedKey) continue; // already on the server from an earlier attempt

      const key = await this.withRetry(() => this.uploadOne(photo));
      current = {
        ...current,
        photos: current.photos.map((p) => (p.id === photo.id ? { ...p, uploadedKey: key } : p)),
      };
      await this.drafts.save(current); // remember the progress
    }

    const photoKeys = current.photos.map((p) => p.uploadedKey).filter((key): key is string => key !== undefined);
    const receipt = await this.withRetry(() => this.reports.submit(current.idempotencyKey, toSubmitRequest(current, photoKeys)));

    await this.drafts.clear();
    return receipt;
  }

  // Slot and upload are ONE unit, so a retry always gets a fresh, unexpired slot
  private async uploadOne(photo: DraftPhoto): Promise<string> {
    const slot = await this.photos.createSlot({ contentType: photo.contentType, sizeBytes: photo.bytes.byteLength });
    await this.photos.sendPhoto(slot.uploadUrl, photo.contentType, photo.bytes);
    return slot.key;
  }

  private withRetry<T>(action: () => Promise<T>): Promise<T> {
    return withRetry(action, { ...this.retry, sleeper: this.sleeper });
  }
}
