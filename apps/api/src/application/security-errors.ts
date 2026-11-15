// Same message for a wrong password, an unknown email and a disabled account
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Email or password is incorrect");
    this.name = "InvalidCredentialsError";
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("You need to log in");
    this.name = "UnauthorizedError";
  }
}

export class TooManyRequestsError extends Error {
  constructor() {
    super("Too many requests. Please wait a moment and try again.");
    this.name = "TooManyRequestsError";
  }
}
