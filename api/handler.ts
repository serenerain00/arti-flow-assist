// Vercel serverless adapter for the TanStack Start SSR build.
//
// `vite build` (with the Cloudflare plugin disabled — see vite.config.ts)
// produces dist/server/server.js, which exports a default
// `{ fetch: (Request) => Promise<Response> }` object. Vercel's Node
// runtime supports default-exported Web fetch handlers, so we just pass
// the request through.
//
// This file lives in `api/` so Vercel auto-deploys it as a serverless
// function. `vercel.json` rewrites everything that isn't a static asset
// from dist/client/ to this handler, giving us SSR + server functions.
//
// Runtime is Node (not Edge) because the SSR bundle uses
// node:async_hooks (AsyncLocalStorage) which isn't in the Edge runtime.

// @ts-expect-error — dist/server is generated at build time.
import server from "../dist/server/server.js";

export const config = {
  runtime: "nodejs20.x",
};

export default async function handler(request: Request): Promise<Response> {
  return server.fetch(request);
}
