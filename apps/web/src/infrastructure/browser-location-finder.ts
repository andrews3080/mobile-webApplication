import { LocationUnavailableError } from "../core/errors";
import type { LocationFinder, MapPosition } from "../core/ports";

const TIMEOUT_MS = 20_000; // GPS can be slow in rural areas

// Asks the phone for its position. Only called when the reporter presses the button, never on its own.
export class BrowserLocationFinder implements LocationFinder {
  current(): Promise<MapPosition> {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new LocationUnavailableError("This browser cannot share your position. You can still type the place name."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (error) => {
          const message =
            error.code === error.PERMISSION_DENIED
              ? "Permission to use your position was not given. You can still type the place name."
              : undefined;
          reject(new LocationUnavailableError(message));
        },
        { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: 60_000 },
      );
    });
  }
}
