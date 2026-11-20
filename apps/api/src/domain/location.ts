import { DomainError } from "./errors";

export interface LocationInput {
  area: string; // the district (or "District not known, <Region>"); routes the report to officers (compulsory)
  latitude?: number; // GPS, optional
  longitude?: number; // GPS, optional
  placeDetails?: string; // town, community or landmark in the reporter's words, optional, officers only
}

export const MAX_PLACE_DETAILS = 200;

// Value object: validated once on creation, never changed afterwards
export class Location {
  private constructor(
    readonly area: string,
    readonly latitude: number | undefined,
    readonly longitude: number | undefined,
    readonly placeDetails: string | undefined, // never public: it can point at a person's farm or house
  ) {}

  static create(input: LocationInput): Location {
    const area = input.area?.trim() ?? "";
    if (area.length === 0) throw new DomainError("Location needs an area (district or community)");
    if (area.length > 100) throw new DomainError("Area name is too long");

    const { latitude, longitude } = input;

    // Both coordinates or neither. One alone is useless.
    if ((latitude === undefined) !== (longitude === undefined)) {
      throw new DomainError("Give both latitude and longitude, or neither");
    }
    if (latitude !== undefined && longitude !== undefined) {
      const valid =
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;
      if (!valid) throw new DomainError("Coordinates are out of range");
    }

    const placeDetails = input.placeDetails?.trim() || undefined;
    if (placeDetails && placeDetails.length > MAX_PLACE_DETAILS) throw new DomainError("Place details are too long");

    return new Location(area, latitude, longitude, placeDetails);
  }

  get hasCoordinates(): boolean {
    return this.latitude !== undefined;
  }

  // The ONLY location text that may appear on public pages (Requirement 4): the district, never the details
  toPublicArea(): string {
    return this.area;
  }
}
