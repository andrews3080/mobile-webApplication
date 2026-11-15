import type { UserAccount } from "../domain/user-account";
import type { UserFinder } from "../application/security-ports";

export class InMemoryUserStore implements UserFinder {
  private readonly byId = new Map<string, UserAccount>();

  // Not on the UserFinder port. Account creation comes later (CreateOfficerAccount).
  add(account: UserAccount): void {
    this.byId.set(account.id, account);
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const wanted = email.trim().toLowerCase();
    for (const account of this.byId.values()) {
      if (account.email.toLowerCase() === wanted) return account;
    }
    return null;
  }

  async findById(id: string): Promise<UserAccount | null> {
    return this.byId.get(id) ?? null;
  }
}
