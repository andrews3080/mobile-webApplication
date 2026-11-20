import type { TokenStore } from "@asaase-ani/shared";
import * as SecureStore from "expo-secure-store";

const KEY = "asaase-ani.officer-token";

// The login token is kept in the phone's encrypted storage (Android Keystore / iOS Keychain),
// so it survives restarts but is not readable by other apps.
// SecureStore does not exist in the browser preview, so there it falls back to memory only.
export class SecureTokenStore implements TokenStore {
  private memory: string | null = null;

  load(): string | null {
    try {
      return SecureStore.getItem(KEY) ?? this.memory;
    } catch {
      return this.memory;
    }
  }

  save(token: string): void {
    this.memory = token;
    try {
      SecureStore.setItem(KEY, token);
    } catch {
      // browser preview: memory only
    }
  }

  clear(): void {
    this.memory = null;
    SecureStore.deleteItemAsync(KEY).catch(() => undefined);
  }
}
