/**
 * Base class for business-rule violations. Knows nothing about HTTP:
 * translation to status codes lives in interfaces/http/errorMapper.ts.
 *
 * Every subclass declares a stable machine-readable `code` (static),
 * so clients can react to errors without parsing human-readable messages.
 */
export class DomainError extends Error {
  static code = 'DOMAIN_ERROR';

  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = (new.target as typeof DomainError).code;
    if (details !== undefined) this.details = details;
  }
}

// ---------- users / auth ----------

export class EmailAlreadyTakenError extends DomainError {
  static override code = 'EMAIL_TAKEN';
  constructor(message = 'User with this email already exists') {
    super(message);
  }
}

// Deliberately does not say whether the email or the password was wrong
export class InvalidCredentialsError extends DomainError {
  static override code = 'INVALID_CREDENTIALS';
  constructor(message = 'Wrong email or password') {
    super(message);
  }
}

export class UserNotFoundError extends DomainError {
  static override code = 'USER_NOT_FOUND';
  constructor(message = 'User not found') {
    super(message);
  }
}
