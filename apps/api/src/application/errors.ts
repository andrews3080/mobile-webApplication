export class NotFoundError extends Error {
  constructor(message = "Report not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRequestError";
  }
}

// Deliberately vague. The real reason goes to the audit log, not to the caller.
export class ForbiddenError extends Error {
  constructor(message = "You are not allowed to do this") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// Someone else changed the report between our read and our save
export class ConflictError extends Error {
  constructor(message = "This report was just updated by someone else. Reload it and try again.") {
    super(message);
    this.name = "ConflictError";
  }
}
