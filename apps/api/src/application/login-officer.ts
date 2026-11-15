import { InvalidCredentialsError } from "./security-errors";
import type { PasswordHasher, TokenService, UserFinder } from "./security-ports";

export class LoginOfficer {
  constructor(
    private readonly users: UserFinder,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async execute(email: string, password: string): Promise<{ token: string }> {
    const user = await this.users.findByEmail(email);

    // Always check a password, even for unknown emails, so timing reveals nothing
    const passwordOk = await this.hasher.verify(password, user?.passwordHash ?? "");

    // One error for every failure: wrong password, unknown email, disabled account
    if (!user || !passwordOk || !user.active) throw new InvalidCredentialsError();

    return { token: this.tokens.issue(user.id) };
  }
}
