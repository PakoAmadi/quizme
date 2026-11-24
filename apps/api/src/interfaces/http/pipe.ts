import type { Empty, Handler, Stage } from './types.ts';

/**
 * Composes stages into a route handler. The overloads make the context typed:
 * a stage can only be placed after the stages that provide what it needs,
 * e.g. requireRole('admin') does not compile before the auth stage.
 */
export function pipe<A extends object>(s1: Stage<Empty, A>): Handler;
export function pipe<A extends object, B extends object>(s1: Stage<Empty, A>, s2: Stage<A, B>): Handler;
export function pipe<A extends object, B extends object, C extends object>(
  s1: Stage<Empty, A>,
  s2: Stage<A, B>,
  s3: Stage<A & B, C>,
): Handler;
export function pipe<A extends object, B extends object, C extends object, D extends object>(
  s1: Stage<Empty, A>,
  s2: Stage<A, B>,
  s3: Stage<A & B, C>,
  s4: Stage<A & B & C, D>,
): Handler;
export function pipe<A extends object, B extends object, C extends object, D extends object, E extends object>(
  s1: Stage<Empty, A>,
  s2: Stage<A, B>,
  s3: Stage<A & B, C>,
  s4: Stage<A & B & C, D>,
  s5: Stage<A & B & C & D, E>,
): Handler;
export function pipe<
  A extends object,
  B extends object,
  C extends object,
  D extends object,
  E extends object,
  F extends object,
>(
  s1: Stage<Empty, A>,
  s2: Stage<A, B>,
  s3: Stage<A & B, C>,
  s4: Stage<A & B & C, D>,
  s5: Stage<A & B & C & D, E>,
  s6: Stage<A & B & C & D & E, F>,
): Handler;
export function pipe(...stages: Stage<any, any>[]): Handler {
  return async (req, res, route) => {
    let ctx: object = {};
    for (const stage of stages) {
      if (res.headersSent) return; // a previous stage already answered
      const added = await stage(req, res, route, ctx);
      if (added) ctx = { ...ctx, ...added };
    }
  };
}
