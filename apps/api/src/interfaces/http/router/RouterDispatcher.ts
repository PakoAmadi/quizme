import { mapError } from '../errorMapper.ts';
import { MethodNotAllowedError, NotFoundError } from '../errors.ts';
import { sendJson } from '../respond.ts';
import type { Req, Res } from '../types.ts';
import type { LookupResult } from './Router.ts';

export interface RouteLookup {
  lookup(method: string, pathname: string): LookupResult;
}

export class RouterDispatcher {
  readonly #router: RouteLookup;

  constructor(router: RouteLookup) {
    this.#router = router;
  }

  async dispatch(req: Req, res: Res): Promise<void> {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const match = this.#router.lookup(req.method ?? 'GET', url.pathname);

      if ('error' in match) {
        const error =
          match.error === 'METHOD_NOT_ALLOWED'
            ? new MethodNotAllowedError(match.allowed, `Method ${req.method} not allowed`)
            : new NotFoundError(`Route ${req.method} ${url.pathname} not found`);
        this.#handleError(res, error);
        return;
      }

      await match.handler(req, res, { params: match.params, query: url.searchParams });
    } catch (error) {
      this.#handleError(res, error);
    }
  }

  #handleError(res: Res, error: unknown) {
    const mapped = mapError(error);
    if (!mapped) console.error('[CRITICAL SERVER ERROR]:', error instanceof Error ? error.stack : error);

    // Too late to change the status (e.g. a stream already started): just close it
    if (res.headersSent) {
      res.end();
      return;
    }
    if (mapped) sendJson(res, mapped.statusCode, mapped.body, mapped.headers);
    else sendJson(res, 500, { error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
  }
}
