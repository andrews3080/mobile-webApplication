import type { Role } from "../../domain/actor";
import type { UserAccount } from "../../domain/user-account";
import type { UserFinder } from "../../application/security-ports";
import type { Database } from "./pool";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  areas: string[];
  active: boolean;
};

function toAccount(row: UserRow): UserAccount {
  return { id: row.id, email: row.email, passwordHash: row.password_hash, role: row.role, areas: row.areas, active: row.active };
}

export class PostgresUserStore implements UserFinder {
  constructor(private readonly pool: Database) {}

  async findByEmail(email: string): Promise<UserAccount | null> {
    const result = await this.pool.query<UserRow>("SELECT * FROM users WHERE lower(email) = lower($1)", [email.trim()]);
    const row = result.rows[0];
    return row ? toAccount(row) : null;
  }

  async findById(id: string): Promise<UserAccount | null> {
    const result = await this.pool.query<UserRow>("SELECT * FROM users WHERE id = $1", [id]);
    const row = result.rows[0];
    return row ? toAccount(row) : null;
  }

  // Creates the account, or updates it when the id already exists.
  // Not on the UserFinder port: account management (admin use cases) comes later.
  async save(account: UserAccount): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, email, password_hash, role, areas, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email, password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role, areas = EXCLUDED.areas, active = EXCLUDED.active`,
      [account.id, account.email, account.passwordHash, account.role, [...account.areas], account.active],
    );
  }
}
