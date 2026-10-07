import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { expect, test } from "bun:test"
import { Hono } from "hono"
import { Glob } from "../src/util/glob"

const require = createRequire(import.meta.url)

test("patched glob dependencies enumerate exact nested brace selections", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dependency-glob-"))
  try {
    await fs.mkdir(path.join(directory, "src"))
    await Promise.all(
      ["one.ts", "two.js", "three.txt"].map((name) => fs.writeFile(path.join(directory, "src", name), name)),
    )
    expect((await Glob.scan("src/{one,two}.{ts,js}", { cwd: directory })).sort()).toEqual([
      path.join("src", "one.ts"),
      path.join("src", "two.js"),
    ])
    expect(Glob.match("src/{one,{two,three}}.ts", "src/three.ts")).toBe(true)
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
})

test("the real Node proxy owner delivers exact streamed HTTP data and disposes its dispatcher", async () => {
  const result = await promisify(execFile)(
    "node",
    [
      "--experimental-transform-types",
      fileURLToPath(new URL("./fixture/dependency-proxy-contract.mjs", import.meta.url)),
    ],
    { timeout: 15_000 },
  )
  expect(JSON.parse(result.stdout)).toEqual({
    status: 201,
    contract: "dependency-transport",
    body: "first:second",
    tunnels: 1,
    disposed: true,
  })
}, 20_000)

test("the installed search-engine Axios dependency preserves exact HTTP response data", async () => {
  const axios = createRequire(require.resolve("open-websearch/build/engines/bing/bing.js"))("axios")
  const app = new Hono().get("/result", (c) => c.json({ path: c.req.path, result: "actual transport" }))
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: app.fetch,
  })
  try {
    const response = await axios.get(`http://127.0.0.1:${server.port}/result`, { proxy: false })
    expect({ status: response.status, data: response.data }).toEqual({
      status: 200,
      data: { path: "/result", result: "actual transport" },
    })
  } finally {
    await server.stop(true)
  }
})

test("AJV's installed URI implementation serializes valid authorities and rejects malformed ports", () => {
  const uri = createRequire(require.resolve("ajv"))("fast-uri")
  expect(uri.serialize({ scheme: "https", host: "EXAMPLE.COM", path: "/a b", port: 443 })).toBe(
    "https://EXAMPLE.COM/a%20b",
  )
  expect(() => uri.serialize({ scheme: "https", host: "example.com", port: "443@evil.example" })).toThrow(
    new TypeError("URI port is malformed."),
  )
})

test("Astro's installed serializer round-trips shared content values and dates", () => {
  const web = createRequire(new URL("../../web/package.json", import.meta.url))
  const devalue = createRequire(web.resolve("astro"))("devalue")
  const date = new Date("2026-10-05T00:00:00.000Z")
  const input = { title: "content contract", date, labels: new Map([["first", "plain text"]]), repeated: date }
  const result = devalue.parse(devalue.stringify(input))
  expect(result).toEqual(input)
  expect(result.repeated === result.date).toBe(true)
})
