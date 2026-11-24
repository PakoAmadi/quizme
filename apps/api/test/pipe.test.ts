import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pipe } from '../src/interfaces/http/pipe.ts';
import type { Stage } from '../src/interfaces/http/types.ts';
import { mockReq, mockRes, route } from './helpers.ts';

test('pipe', async (t) => {
  await t.test('accumulates context across stages', async () => {
    const a: Stage<object, { a: number }> = () => ({ a: 1 });
    const b: Stage<{ a: number }, { b: number }> = async (_q, _s, _r, ctx) => ({ b: ctx.a + 1 });
    let seen: unknown;
    const last: Stage<{ a: number; b: number }> = (_q, _s, _r, ctx) => {
      seen = ctx;
    };
    await pipe(a, b, last)(mockReq(), mockRes().res, route());
    assert.deepEqual(seen, { a: 1, b: 2 });
  });

  await t.test('stops after a stage has answered', async () => {
    let reached = false;
    const answer: Stage = (_q, res) => {
      res.writeHead(204);
      res.end();
    };
    const after: Stage = () => {
      reached = true;
    };
    await pipe(answer, after)(mockReq(), mockRes().res, route());
    assert.equal(reached, false);
  });

  await t.test('propagates errors thrown by a stage', async () => {
    const boom: Stage = () => {
      throw new Error('boom');
    };
    await assert.rejects(pipe(boom)(mockReq(), mockRes().res, route()), /boom/);
  });
});
