import * as E from '../../domain/errors.ts';
import { HttpError } from './errors.ts';

// Domain error class -> HTTP status
const STATUS_BY_DOMAIN_ERROR = new Map<unknown, number>([
  [E.InvalidCredentialsError, 401],
  [E.UserNotFoundError, 404],
  [E.EmailAlreadyTakenError, 409],
]);

const DEFAULT_DOMAIN_STATUS = 400;

// Walks up the prototype chain, so a subclass inherits its parent's status
const statusFor = (error: E.DomainError): number => {
  for (let C: unknown = error.constructor; C && C !== E.DomainError; C = Object.getPrototypeOf(C)) {
    const status = STATUS_BY_DOMAIN_ERROR.get(C);
    if (status !== undefined) return status;
  }
  return DEFAULT_DOMAIN_STATUS;
};

export interface ErrorBody {
  error: string;
  code: string;
  details?: unknown;
}

/**
 * Translates a thrown error into an HTTP response.
 * Returns null for unexpected errors: the caller responds 500 and logs it.
 */
export interface MappedError {
  statusCode: number;
  body: ErrorBody;
  headers?: Readonly<Record<string, string>>;
}

export const mapError = (error: unknown): MappedError | null => {
  let statusCode: number;
  if (error instanceof HttpError) statusCode = error.statusCode;
  else if (error instanceof E.DomainError) statusCode = statusFor(error);
  else return null;

  const body: ErrorBody = { error: error.message, code: error.code };
  if (error.details !== undefined) body.details = error.details;

  const mapped: MappedError = { statusCode, body };
  if (error instanceof HttpError && error.headers) mapped.headers = error.headers;
  return mapped;
};
