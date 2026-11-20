import type {
  Clock,
  DraftStore,
  IdGenerator,
  ImageCompressor,
  LocationFinder,
  PhotoUploadApi,
  ReportSubmitApi,
  Sleeper,
} from "../core/ports";

// Everything the screens need from the outside world. The real ones are built in app/browser-services.ts;
// tests pass fakes, so the screens never touch the network, the disk or the GPS directly.
export interface ReportServices {
  drafts: DraftStore;
  photos: PhotoUploadApi;
  reports: ReportSubmitApi;
  compressor: ImageCompressor;
  location: LocationFinder;
  clock: Clock;
  ids: IdGenerator;
  sleeper: Sleeper;
}
