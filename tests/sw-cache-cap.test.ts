import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Runs public/sw.js against an in-memory Cache Storage. Map keeps insertion
// order like the real Cache; put() deletes first so a re-put moves to the end.
function boot() {
  const store = new Map<string, Response>();
  const cache = {
    put: async (req: Request, res: Response) => void (store.delete(req.url), store.set(req.url, res)),
    keys: async () => [...store.keys()].map((u) => new Request(u)),
    delete: async (req: Request) => store.delete(req.url),
    match: async (req: Request) => store.get(req.url),
  };
  const handlers: Record<string, (e: unknown) => void> = {};
  const self = { addEventListener: (t: string, h: (e: unknown) => void) => (handlers[t] = h) };
  const caches = { open: async () => cache };
  const fetchOk = async () => new Response("ok");
  new Function("self", "caches", "fetch", "location", readFileSync("public/sw.js", "utf8"))(
    self, caches, fetchOk, { origin: "https://example.test" },
  );
  async function get(path: string) {
    let done: Promise<unknown> = Promise.resolve();
    const request = new Request(`https://example.test${path}`);
    handlers.fetch({ request, respondWith: (p: Promise<unknown>) => (done = p) });
    await done;
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); // let put + trim settle
  }
  return { store, get };
}

test("old builds are trimmed to 150 entries, newest kept", async () => {
  const { store, get } = boot();
  for (let i = 0; i < 160; i++) await get(`/_next/static/chunks/old-${i}.js`);
  expect(store.size).toBe(150);
  expect(store.has("https://example.test/_next/static/chunks/old-0.js")).toBe(false);
  expect(store.has("https://example.test/_next/static/chunks/old-159.js")).toBe(true);
});

test("a file fetched again moves to the back and survives the trim", async () => {
  const { store, get } = boot();
  await get("/");
  for (let i = 0; i < 149; i++) await get(`/_next/static/chunks/a-${i}.js`);
  await get("/"); // the shell is refreshed on every visit
  await get("/_next/static/chunks/new.js");
  expect(store.size).toBe(150);
  expect(store.has("https://example.test/")).toBe(true);
  expect(store.has("https://example.test/_next/static/chunks/a-0.js")).toBe(false);
});
