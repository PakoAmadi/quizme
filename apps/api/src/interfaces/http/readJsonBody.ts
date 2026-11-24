import { BadRequestError, PayloadTooLargeError } from './errors.ts';
import type { Req } from './types.ts';

const MAX_BODY_SIZE = 1024 * 1024; // file imports will get their own, streaming endpoint

export const readJsonBody = async (req: Req, maxBytes = MAX_BODY_SIZE): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > maxBytes) throw new PayloadTooLargeError();
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new BadRequestError('Invalid JSON payload');
  }
};
