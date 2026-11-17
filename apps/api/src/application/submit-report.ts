import { isPhotoKey } from "../domain/image-type";
import { Report } from "../domain/report";
import type { Contact } from "../domain/report";
import { Location } from "../domain/location";
import { InvalidRequestError } from "./errors";
import type { PhotoChecker } from "./photo-ports";
import type { Clock, Notifier, ReferenceGenerator, ReportSubmissionStore } from "./ports";

export interface SubmitReportInput {
  idempotencyKey: string; // created ONCE per draft by the web client and reused on every retry
  description: string;
  category: string;
  observedAt: Date;
  area: string;
  latitude?: number;
  longitude?: number;
  photoKeys?: string[]; // keys returned by the upload step
  contact?: Contact;
}

export interface SubmitReportResult {
  reference: string; // what the reporter keeps, formatted XXXX-XXXX-XXXX
  alreadyReceived: boolean; // true when this was a retry of an earlier submission
}

// S: this class only orchestrates. Validation lives in the domain, storage behind the ports.
export class SubmitReport {
  constructor(
    private readonly repo: ReportSubmissionStore,
    private readonly refs: ReferenceGenerator,
    private readonly notifier: Notifier,
    private readonly clock: Clock,
    private readonly photos: PhotoChecker,
  ) {}

  async execute(input: SubmitReportInput): Promise<SubmitReportResult> {
    const key = input.idempotencyKey?.trim() ?? "";
    if (key.length < 16 || key.length > 100) {
      throw new InvalidRequestError("A valid idempotency key is required");
    }

    // Every photo must be one WE stored: right format, and really uploaded
    const photoKeys = input.photoKeys ?? [];
    if (photoKeys.length > 0) {
      const present = photoKeys.every(isPhotoKey) && (await this.photos.allExist(photoKeys));
      if (!present) {
        throw new InvalidRequestError("One or more photos were not uploaded. Upload each photo first, then use its key.");
      }
    }

    // The domain validates everything and throws DomainError if anything is wrong
    const location = Location.create({
      area: input.area,
      latitude: input.latitude,
      longitude: input.longitude,
    });
    const report = Report.create(
      {
        reference: this.refs.next(),
        description: input.description,
        category: input.category,
        observedAt: input.observedAt,
        location,
        photoKeys: input.photoKeys,
        contact: input.contact,
      },
      this.clock.now(),
    );

    // On a retry this returns the ORIGINAL report, so no duplicate is ever created
    const { report: saved, created } = await this.repo.saveIfNew(report, key);

    // Alert officers only on the first save, so retries do not spam them
    if (created) {
      try {
        await this.notifier.notifyNewReport(saved);
      } catch {
        // The report is safely stored, so a failed alert must not fail the reporter.
        // Known gap: later we add logging and a retry queue here.
      }
    }

    return { reference: saved.reference.toString(), alreadyReceived: !created };
  }
}
