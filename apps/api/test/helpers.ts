import { Readable } from 'node:stream';
import type { OutgoingHttpHeaders } from 'node:http';
import type { Req, Res, RouteInfo } from '../src/interfaces/http/types.ts';

export interface MockRes {
  statusCode: number | null;
  headers: OutgoingHttpHeaders;
  body: any;
  headersSent: boolean;
  ended: boolean;
}

/** Minimal ServerResponse: records status, headers and the JSON body. */
export const mockRes = () => {
  const state: MockRes & Record<string, unknown> = {
    statusCode: null,
    headers: {},
    body: null,
    headersSent: false,
    ended: false,
    setHeader(name: string, value: unknown) {
      state.headers[name.toLowerCase()] = value as string;
    },
    writeHead(status: number, headers: OutgoingHttpHeaders = {}) {
      state.statusCode = status;
      for (const [k, v] of Object.entries(headers)) state.headers[k.toLowerCase()] = v;
      state.headersSent = true;
    },
    end(data?: string) {
      state.ended = true;
      if (data) state.body = JSON.parse(data);
    },
  };
  return { res: state as unknown as Res, state };
};

export const mockReq = ({
  method = 'GET',
  url = '/',
  headers = {},
  body,
}: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
} = {}): Req => {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
  return Object.assign(stream, {
    method,
    url,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
  }) as unknown as Req;
};

export const route = (params: Record<string, string> = {}): RouteInfo => ({
  params,
  query: new URLSearchParams(),
});
