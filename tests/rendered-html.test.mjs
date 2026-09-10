import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// This is an SSR smoke test, not a database integration test. The D1 and
// authenticated API flows are exercised separately in exam-engine.test.mjs.
register('data:text/javascript,' + encodeURIComponent(`
 export async function resolve(specifier, context, nextResolve) {
   if (specifier === 'cloudflare:workers') return {url:'data:text/javascript,export const env = {};',shortCircuit:true};
   return nextResolve(specifier, context);
 }
`), import.meta.url);

test("renders the Portuguese production application metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=31536000/);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  const html = await response.text();
  assert.match(html, /<html[^>]*lang="pt-BR"/i);
  assert.match(html, /<title>Aprova Concurso<\/title>/i);
  assert.doesNotMatch(html, /name="codex-preview"/i);
});
