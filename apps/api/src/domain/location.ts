import { DomainError } from "./errors";

export interface LocationInput {
  area: string; // district or community name (compulsory)
  latitude?: number; // GPS, optional
  longitude?: number; // GPS, optional
}

// Value object: validated once on creation, never changed afterwards
export class Location {
  private constructor(
    readonly area: string,
    readonly latitude: number | undefined,
    readonly longitude: number | undefined,
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

    return new Location(area, latitude, longitude);
  }

  get hasCoordinates(): boolean {
    return this.latitude !== undefined;
  }

  // The ONLY location text that may appear on public pages (Requirement 4)
  toPublicArea(): string {
    return this.area;
  }
}
