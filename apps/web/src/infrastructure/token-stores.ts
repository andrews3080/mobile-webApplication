import type { TokenStore } from "@asaase-ani/shared";

const KEY = "asaase-ani.officer-token";

// sessionStorage: survives a page refresh, but is gone when the tab or browser is closed.
// That suits shared office computers. Storage can be blocked (private mode, strict settings),
// so every access is guarded and the officer simply has to log in again.
export class SessionTokenStore implements TokenStore {
  load(): string | null {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  }

  save(token: string): void {
    try {
      sessionStorage.setItem(KEY, token);
    } catch {
      // not fatal: the session just will not survive a refresh
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // nothing to clear
    }
  }
}

export class InMemoryTokenStore implements TokenStore {
  constructor(private token: string | null = null) {}

  load(): string | null {
    return this.token;
  }

  save(token: string): void {
    this.token = token;
  }

  clear(): void {
    this.token = null;
  }
}
