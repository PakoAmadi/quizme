import type { OutgoingHttpHeaders } from 'node:http';
import type { Res } from './types.ts';

export const sendJson = (res: Res, status: number, body: unknown, headers: OutgoingHttpHeaders = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
};

export const sendNoContent = (res: Res, headers: OutgoingHttpHeaders = {}) => {
  res.writeHead(204, headers);
  res.end();
};
