import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as E from '../src/domain/errors.ts';
import { mapError } from '../src/interfaces/http/errorMapper.ts';
import * as H from '../src/interfaces/http/errors.ts';

test('mapError', async (t) => {
  const status = (err: unknown) => mapError(err)!.statusCode;

  await t.test('keeps HttpError status codes and adds machine code', () => {
    assert.deepEqual(mapError(new H.ConflictError('dup')), { statusCode: 409, body: { error: 'dup', code: 'CONFLICT' } });
  });

  await t.test('ValidationError is a 400 with per-field details', () => {
    const err = new H.ValidationError({ email: 'Invalid email format' });
    assert.deepEqual(mapError(err), {
      statusCode: 400,
      body: { error: 'Validation failed', code: 'VALIDATION_ERROR', details: { email: 'Invalid email format' } },
    });
  });

  await t.test('CsrfError is a 403 with its own code', () => {
    assert.deepEqual(mapError(new H.CsrfError()), {
      statusCode: 403,
      body: { error: 'Invalid CSRF token', code: 'CSRF_TOKEN_INVALID' },
    });
  });

  await t.test('MethodNotAllowedError carries the Allow header', () => {
    assert.deepEqual(mapError(new H.MethodNotAllowedError(['GET', 'PATCH'])), {
      statusCode: 405,
      body: { error: 'Method Not Allowed', code: 'METHOD_NOT_ALLOWED' },
      headers: { Allow: 'GET, PATCH' },
    });
  });

  await t.test('maps domain errors to their statuses', () => {
    assert.equal(status(new E.InvalidCredentialsError()), 401);
    assert.equal(status(new E.UserNotFoundError()), 404);
    assert.equal(status(new E.EmailAlreadyTakenError()), 409);
    assert.equal(status(new E.DomainError('any rule')), 400);
  });

  await t.test('a subclass inherits its parent status', () => {
    class DeletedUserError extends E.UserNotFoundError {
      static override code = 'USER_DELETED';
    }
    const mapped = mapError(new DeletedUserError())!;
    assert.equal(mapped.statusCode, 404);
    assert.equal(mapped.body.code, 'USER_DELETED');
  });

  await t.test('every error class has a unique UPPER_SNAKE code', () => {
    const classes = [...Object.values(E), ...Object.values(H)] as { code: string }[];
    const codes = classes.map((C) => C.code);
    assert.ok(codes.every((c) => /^[A-Z_]+$/.test(c)));
    assert.equal(new Set(codes).size, codes.length);
  });

  await t.test('returns null for unexpected errors', () => {
    assert.equal(mapError(new Error('boom')), null);
    assert.equal(mapError('string'), null);
  });
});
