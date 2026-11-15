import { DomainError } from "./errors";
import { Location } from "./location";
import { ReferenceCode } from "./reference-code";
import { ReportStatus, canTransition, STATUSES_REQUIRING_REASON } from "./status";

// Placeholder list. Move to config or database later if the lecturer or officers want changes.
export const REPORT_CATEGORIES = [
  "excavation_site",
  "river_pollution",
  "forest_clearing",
  "machinery_or_equipment",
  "other",
] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export interface Contact {
  name?: string;
  phone?: string;
  email?: string;
}

// One line in the report's history, so tracking and audits can show what happened
export interface StatusEvent {
  from: ReportStatus;
  to: ReportStatus;
  officerId: string;
  reason?: string;
  at: Date;
}

export interface NewReportInput {
  reference: ReferenceCode;
  description: string;
  category: string; // arrives as plain text from the outside, validated below
  observedAt: Date;
  location: Location;
  photoKeys?: string[];
  contact?: Contact;
}

// The saved form of a report, as a database adapter reads it back
export interface ReportSnapshot {
  reference: string;
  description: string;
  category: string;
  observedAt: Date;
  createdAt: Date;
  area: string;
  latitude?: number;
  longitude?: number;
  photoKeys: string[];
  contact?: Contact;
  status: ReportStatus;
  history: StatusEvent[];
}
const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 2000;
const MAX_PHOTOS = 5;
const CLOCK_SKEW_MS = 5 * 60 * 1000; // phone clocks can be a few minutes ahead

export class Report {
  private constructor(
    readonly reference: ReferenceCode,
    readonly description: string,
    readonly category: ReportCategory,
    readonly observedAt: Date,
    readonly location: Location,
    readonly photoKeys: readonly string[],
    readonly contact: Contact | undefined,
    readonly status: ReportStatus,
    readonly createdAt: Date,
    readonly history: readonly StatusEvent[],
  ) {}

  // "now" is passed in, never read from the system clock. This keeps the domain testable.
  static create(input: NewReportInput, now: Date): Report {
    const description = input.description?.trim() ?? "";
    if (description.length < MIN_DESCRIPTION) {
      throw new DomainError(`Description must be at least ${MIN_DESCRIPTION} characters`);
    }
    if (description.length > MAX_DESCRIPTION) {
      throw new DomainError(`Description must be at most ${MAX_DESCRIPTION} characters`);
    }

    const category = REPORT_CATEGORIES.find((c) => c === input.category);
    if (!category) throw new DomainError("Unknown report category");

    if (Number.isNaN(input.observedAt.getTime())) {
      throw new DomainError("Observation date is not valid");
    }
    if (input.observedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) {
      throw new DomainError("Observation date cannot be in the future");
    }

    const photoKeys = input.photoKeys ?? [];
    if (photoKeys.length > MAX_PHOTOS) {
      throw new DomainError(`A report can have at most ${MAX_PHOTOS} photos`);
    }
    if (photoKeys.some((key) => key.trim().length === 0)) {
      throw new DomainError("Photo reference cannot be empty");
    }

    return new Report(
      input.reference,
      description,
      category,
      input.observedAt,
      input.location,
      [...photoKeys],
      Report.cleanContact(input.contact),
      "received", // every report starts here
      now,
      [],
    );
  }

  // Rebuilds a report that was SAVED earlier (used by the database adapter).
  // It re-checks the shape of the data, but trusts the stored status and history,
  // because the rules were already enforced when they were first written.
  static restore(snapshot: ReportSnapshot): Report {
    const category = REPORT_CATEGORIES.find((c) => c === snapshot.category);
    if (!category) throw new DomainError("Stored report has an unknown category");
    return new Report(
      ReferenceCode.parse(snapshot.reference),
      snapshot.description,
      category,
      snapshot.observedAt,
      Location.create({ area: snapshot.area, latitude: snapshot.latitude, longitude: snapshot.longitude }),
      [...snapshot.photoKeys],
      snapshot.contact,
      snapshot.status,
      snapshot.createdAt,
      [...snapshot.history],
    );
  }
  // Reports are immutable: a status change returns a NEW Report and leaves this one untouched
  transitionTo(next: ReportStatus, officerId: string, at: Date, reason?: string): Report {
    if (!canTransition(this.status, next)) {
      throw new DomainError(`A report cannot move from "${this.status}" to "${next}"`);
    }
    if (officerId.trim().length === 0) {
      throw new DomainError("Every status change must be linked to an officer");
    }

    const cleanReason = reason?.trim();
    if (STATUSES_REQUIRING_REASON.includes(next) && (!cleanReason || cleanReason.length < 5)) {
      throw new DomainError(`Moving to "${next}" needs a recorded reason`);
    }

    const event: StatusEvent = { from: this.status, to: next, officerId, reason: cleanReason, at };
    return new Report(
      this.reference,
      this.description,
      this.category,
      this.observedAt,
      this.location,
      this.photoKeys,
      this.contact,
      next,
      this.createdAt,
      [...this.history, event],
    );
  }

  // Empty form fields become "no contact". Anything given must look sensible.
  private static cleanContact(contact?: Contact): Contact | undefined {
    if (!contact) return undefined;
    const name = contact.name?.trim() || undefined;
    const phone = contact.phone?.trim() || undefined;
    const email = contact.email?.trim() || undefined;

    if (!name && !phone && !email) return undefined;
    if (phone && !/^\+?[0-9\s-]{9,15}$/.test(phone)) {
      throw new DomainError("Phone number is not valid");
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new DomainError("Email address is not valid");
    }
    return { name, phone, email };
  }
}

