/** Base class for all errors that carry their own HTTP status. */
export class HttpError extends Error {
  static code = 'HTTP_ERROR';

  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;
  /** Extra response headers the status requires (e.g. Allow for 405). */
  readonly headers?: Readonly<Record<string, string>>;

  constructor(message: string, statusCode = 500, details?: unknown, headers?: Record<string, string>) {
    super(message);
    this.name = new.target.name;
    this.code = (new.target as typeof HttpError).code; // machine-readable, sent to clients
    this.statusCode = statusCode;
    if (details !== undefined) this.details = details;
    if (headers !== undefined) this.headers = headers;
  }
}

export class BadRequestError extends HttpError {
  static override code = 'BAD_REQUEST';
  constructor(message = 'Bad Request', details?: unknown) {
    super(message, 400, details);
  }
}

/** Request body failed validation. `details` maps field path -> message. */
export class ValidationError extends BadRequestError {
  static override code = 'VALIDATION_ERROR';
  constructor(errors: Record<string, string>) {
    super('Validation failed', errors);
  }
}

export class UnauthorizedError extends HttpError {
  static override code = 'UNAUTHORIZED';
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends HttpError {
  static override code = 'FORBIDDEN';
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

/** Missing or wrong CSRF token: the client should fetch a new one and retry. */
export class CsrfError extends ForbiddenError {
  static override code = 'CSRF_TOKEN_INVALID';
  constructor(message = 'Invalid CSRF token') {
    super(message);
  }
}

export class NotFoundError extends HttpError {
  static override code = 'NOT_FOUND';
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}

/** RFC 9110 §15.5.6: a 405 response MUST list the supported methods in Allow. */
export class MethodNotAllowedError extends HttpError {
  static override code = 'METHOD_NOT_ALLOWED';
  constructor(allowed: readonly string[], message = 'Method Not Allowed') {
    super(message, 405, undefined, { Allow: allowed.join(', ') });
  }
}

export class ConflictError extends HttpError {
  static override code = 'CONFLICT';
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

export class PayloadTooLargeError extends HttpError {
  static override code = 'PAYLOAD_TOO_LARGE';
  constructor(message = 'Payload Too Large') {
    super(message, 413);
  }
}

export class TooManyRequestsError extends HttpError {
  static override code = 'TOO_MANY_REQUESTS';
  constructor(message = 'Too many requests, try again later') {
    super(message, 429);
  }
}
