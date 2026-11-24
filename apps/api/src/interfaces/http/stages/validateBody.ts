import type { z } from 'zod';
import { ValidationError } from '../errors.ts';
import { readJsonBody } from '../readJsonBody.ts';
import type { Stage } from '../types.ts';

const toFieldErrors = (error: z.ZodError): Record<string, string> => {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    errors[key] ??= issue.message; // first message per field
  }
  return errors;
};

/** Reads the JSON body, validates it with a schema from @app/shared and puts the result into ctx.body. */
export const validateBody =
  <S extends z.ZodType>(schema: S): Stage<object, { body: z.output<S> }> =>
  async (req) => {
    const result = schema.safeParse(await readJsonBody(req));
    if (!result.success) throw new ValidationError(toFieldErrors(result.error));
    return { body: result.data };
  };
