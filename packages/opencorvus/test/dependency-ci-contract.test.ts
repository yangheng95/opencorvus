import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"

const backend = createRequire(new URL("../package.json", import.meta.url))
const web = createRequire(new URL("../../web/package.json", import.meta.url))

test("the native file subscription delivers exact created files with brace ignores and settles its owner", async () => {
  const watcher: typeof import("@parcel/watcher") = backend("@parcel/watcher")
  const directory = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "ci-watcher-subscription-")))
  const filename = path.join(directory, "src", "retained.ts")
  const created: Array<{ type: string; path: string }> = []
  const delivery = Promise.withResolvers<void>()
  const timeout = setTimeout(() => delivery.reject(new Error("Native watcher delivery timed out")), 10_000)
  let subscription: import("@parcel/watcher").AsyncSubscription | undefined
  try {
    for (const name of ["cache", "temp", "src"]) await fs.mkdir(path.join(directory, name))
    subscription = await watcher.subscribe(
      directory,
      (error, events) => {
        if (error) return delivery.reject(error)
        created.push(...events.filter((event) => event.type === "create"))
        if (created.some((event) => event.path === filename)) delivery.resolve()
      },
      { ignore: ["**/{cache,temp}/**"] },
    )
    for (const name of ["cache/ignored.ts", "temp/ignored.ts", "src/retained.ts"]) {
      await fs.writeFile(path.join(directory, name), name)
    }
    await delivery.promise
    await subscription.unsubscribe()
    subscription = undefined
    expect(
      created.map((event) => ({ type: event.type, path: path.relative(directory, event.path).replaceAll("\\", "/") })),
    ).toEqual([{ type: "create", path: "src/retained.ts" }])
  } finally {
    clearTimeout(timeout)
    await subscription?.unsubscribe()
    await fs.rm(directory, { recursive: true, force: true })
  }
}, 15_000)

test("Astro's cache policy preserves public hits and routes changed user variants to the origin", () => {
  const CachePolicy = createRequire(web.resolve("astro"))("http-cache-semantics")
  const request = {
    url: "https://example.test/docs",
    method: "GET",
    headers: { host: "example.test", cookie: "user=one" },
  }
  const policy = new CachePolicy(request, {
    status: 200,
    headers: { "cache-control": "public, max-age=120", vary: "cookie", etag: '"docs-v1"' },
  })
  expect(policy.evaluateRequest(request).response).toMatchObject({
    status: 200,
    headers: { etag: '"docs-v1"', vary: "cookie" },
  })
  const changed = { ...request, headers: { ...request.headers, cookie: "user=two", "cache-control": "max-stale" } }
  expect(policy.evaluateRequest(changed).revalidation).toMatchObject({
    synchronous: true,
    headers: { cookie: "user=two" },
  })
  const wildcard = new CachePolicy(request, {
    status: 200,
    headers: { "cache-control": "public, max-age=120", vary: "cookie, * " },
  })
  expect(wildcard.evaluateRequest(changed).revalidation).toMatchObject({
    synchronous: true,
    headers: { cookie: "user=two" },
  })
})

test("the website's nested CSS compiler preserves escaped selectors through its updated parser", async () => {
  let parent = web
  for (const name of [
    "@astrojs/starlight",
    "astro-expressive-code",
    "rehype-expressive-code",
    "expressive-code",
    "@expressive-code/plugin-text-markers",
    "@expressive-code/core",
  ]) {
    parent = createRequire(parent.resolve(name))
  }
  const postcss = parent("postcss")
  const nested = parent("postcss-nested")
  const result = await postcss([nested]).process(".docs { & > .item\\:active { color: red; } }", { from: undefined })
  expect(result.css).toBe(".docs > .item\\:active { color: red; }")
})

test("the ORM's SQL Server parent preserves parameters with the current Tedious driver", () => {
  const orm = createRequire(backend.resolve("drizzle-orm"))
  const sql = orm("mssql")
  const driver = createRequire(orm.resolve("mssql"))("tedious")
  const id = "00112233-4455-6677-8899-aabbccddeeff"
  const request = new sql.Request().input("id", sql.UniqueIdentifier, id).input("title", sql.NVarChar(40), "配置")
  expect(request.parameters.id).toMatchObject({ name: "id", value: id, io: 1 })
  expect(request.parameters.title).toMatchObject({ name: "title", value: "配置", length: 40, io: 1 })
  expect(driver.TYPES.UniqueIdentifier.validate(id)).toBe(id)
  expect(() => driver.TYPES.UniqueIdentifier.validate("invalid-guid")).toThrow(new TypeError("Invalid GUID."))
}, 30_000)
