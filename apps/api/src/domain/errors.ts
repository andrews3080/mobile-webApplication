// Every broken business rule throws this, so callers can tell
// "a rule was violated" apart from "the program crashed"
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
