import type { IncomingMessage, ServerResponse } from 'node:http';

export type Req = IncomingMessage;
export type Res = ServerResponse;

export interface RouteInfo {
  /** Path parameters, already URI-decoded: /api/tests/:id -> { id } */
  params: Record<string, string>;
  query: URLSearchParams;
}

export type Handler = (req: Req, res: Res, route: RouteInfo) => Promise<void>;

export type Empty = Record<never, never>;

/**
 * One step of a request pipeline. Gets the context built by previous stages
 * (`In`) and may return fields to add to it (`Add`). A stage may also answer
 * the request itself; then the remaining stages are skipped.
 */
export type Stage<In extends object = Empty, Add extends object = Empty> = (
  req: Req,
  res: Res,
  route: RouteInfo,
  ctx: In,
) => Add | void | Promise<Add | void>;
