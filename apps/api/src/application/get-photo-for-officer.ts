import type { Actor } from "../domain/actor";
import type { AccessGate } from "./access-gate";
import { NotFoundError } from "./errors";
import { loadReport } from "./load-report";
import type { PhotoReader, StoredPhoto } from "./photo-ports";
import type { ReportFinder } from "./ports";

// An officer gets a photo only THROUGH a report they may access (area rules and audit log apply)
export class GetPhotoForOfficer {
  constructor(
    private readonly repo: ReportFinder,
    private readonly gate: AccessGate,
    private readonly photos: PhotoReader,
  ) {}

  async execute(actor: Actor, code: string, file: string): Promise<StoredPhoto> {
    const found = await loadReport(this.repo, code);
    const report = await this.gate.requireForReport(actor, "photo.view", found);

    // The photo must belong to THIS report. The file name is only compared, never used as a path.
    const key = `photos/${file}`;
    if (!report.photoKeys.includes(key)) throw new NotFoundError("Photo not found");

    const photo = await this.photos.read(key);
    if (!photo) throw new NotFoundError("Photo not found");
    return photo;
  }
}
