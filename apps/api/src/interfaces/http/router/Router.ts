import { BadRequestError } from '../errors.ts';
import type { Handler } from '../types.ts';

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type Method = (typeof METHODS)[number];

const isMethod = (m: string): m is Method => (METHODS as readonly string[]).includes(m);

interface DynamicRoute {
  regex: RegExp;
  paramNames: string[];
  handler: Handler;
}

export type LookupResult =
  | { handler: Handler; params: Record<string, string> }
  /** `allowed`: methods registered for this path — goes into the Allow header */
  | { error: 'METHOD_NOT_ALLOWED'; allowed: Method[] }
  | { error: 'NOT_FOUND' };

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const decode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new BadRequestError('Malformed URL');
  }
};

export class Router {
  readonly #static = new Map<Method, Map<string, Handler>>();
  readonly #dynamic = new Map<Method, DynamicRoute[]>();

  constructor() {
    for (const m of METHODS) {
      this.#static.set(m, new Map());
      this.#dynamic.set(m, []);
    }
  }

  get(path: string, handler: Handler) {
    this.#add('GET', path, handler);
  }
  post(path: string, handler: Handler) {
    this.#add('POST', path, handler);
  }
  put(path: string, handler: Handler) {
    this.#add('PUT', path, handler);
  }
  patch(path: string, handler: Handler) {
    this.#add('PATCH', path, handler);
  }
  delete(path: string, handler: Handler) {
    this.#add('DELETE', path, handler);
  }

  lookup(method: string, pathname: string): LookupResult {
    if (isMethod(method)) {
      const found = this.#match(method, pathname);
      if (found) return found;
    }

    // The path may exist, just not for this method (or the method is unknown, e.g. OPTIONS)
    const allowed = METHODS.filter((m) => m !== method && this.#match(m, pathname));
    return allowed.length ? { error: 'METHOD_NOT_ALLOWED', allowed } : { error: 'NOT_FOUND' };
  }

  #match(method: Method, pathname: string) {
    const handler = this.#static.get(method)!.get(pathname);
    if (handler) return { handler, params: {} };

    for (const route of this.#dynamic.get(method)!) {
      const match = route.regex.exec(pathname);
      if (!match) continue;
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decode(match[i + 1]!);
      });
      return { handler: route.handler, params };
    }
    return null;
  }

  #add(method: Method, path: string, handler: Handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`Handler for ${method} ${path} must be a function, received ${typeof handler}`);
    }

    if (!path.includes(':')) {
      this.#static.get(method)!.set(path, handler);
      return;
    }

    const paramNames: string[] = [];
    const pattern = path
      .split('/')
      .map((segment) => {
        if (!segment.startsWith(':')) return escapeRegex(segment);
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      })
      .join('/');
    this.#dynamic.get(method)!.push({ regex: new RegExp(`^${pattern}$`), paramNames, handler });
  }
}
