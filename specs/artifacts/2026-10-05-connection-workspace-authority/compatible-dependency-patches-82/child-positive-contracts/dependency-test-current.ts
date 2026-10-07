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

test("Solid parent serializers preserve tiny typed views and report the bounded malformed node", () => {
  for (const packageFile of ["../../overlay/package.json", "../../web/package.json"]) {
    const parent = createRequire(new URL(packageFile, import.meta.url))
    const serializer = createRequire(parent.resolve("solid-js"))("seroval")
    const input = new Uint8Array([7, 19, 231])
    const result = serializer.fromJSON(serializer.toJSON(input))
    expect({
      constructor: result.constructor.name,
      bytes: [...result],
      offset: result.byteOffset,
      length: result.length,
    }).toEqual({ constructor: "Uint8Array", bytes: [7, 19, 231], offset: 0, length: 3 })
    const view = new DataView(new Uint8Array([1, 2, 3, 4]).buffer, 1, 2)
    const restored = serializer.fromJSON(serializer.toJSON(view))
    expect({
      constructor: restored.constructor.name,
      offset: restored.byteOffset,
      length: restored.byteLength,
      bytes: [restored.getUint8(0), restored.getUint8(1)],
    }).toEqual({ constructor: "DataView", offset: 1, length: 2, bytes: [2, 3] })
    const malformed = serializer.toJSON(input)
    malformed.t.l = 1_000_001
    let error
    try {
      serializer.fromJSON(malformed)
    } catch (caught) {
      error = caught
    }
    console.log("Seroval bounded error baseline", {
      parent: packageFile,
      outer: error?.constructor.name,
      cause: error?.cause?.constructor.name,
    })
    expect({
      outer: error instanceof serializer.SerovalDeserializationError,
      cause: error?.cause instanceof serializer.SerovalMalformedNodeError,
    }).toEqual({ outer: true, cause: true })
  }
})

test("current source map parents preserve indexed coordinates and explicit invalid offsets", () => {
  const overlay = createRequire(new URL("../../overlay/package.json", import.meta.url))
  const web = createRequire(new URL("../../web/package.json", import.meta.url))
  const astro = createRequire(web.resolve("astro/package.json"))
  const parents = [
    createRequire(createRequire(overlay.resolve("vite/package.json")).resolve("postcss")),
    createRequire(astro.resolve("magicast")),
  ]
  for (const parent of parents) {
    const { SourceMapGenerator, SourceMapConsumer } = parent("source-map-js")
    const generator = new SourceMapGenerator({ file: "generated.js" })
    generator.addMapping({
      generated: { line: 2, column: 0 },
      original: { line: 4, column: 2 },
      source: "original.js",
      name: "owned",
    })
    const map = { version: 3, sections: [{ offset: { line: 2, column: 0 }, map: generator.toJSON() }] }
    const consumer = new SourceMapConsumer(map)
    expect(consumer.originalPositionFor({ line: 4, column: 0 })).toEqual({
      source: "original.js",
      line: 4,
      column: 2,
      name: "owned",
    })
    const rows: unknown[] = []
    consumer.eachMapping(
      (mapping: {
        source: string
        generatedLine: number
        generatedColumn: number
        originalLine: number
        originalColumn: number
      }) =>
        rows.push({
          source: mapping.source,
          generatedLine: mapping.generatedLine,
          generatedColumn: mapping.generatedColumn,
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
        }),
    )
    expect(rows).toEqual([
      {
        source: "original.js",
        generatedLine: 4,
        generatedColumn: 0,
        originalLine: 4,
        originalColumn: 2,
      },
    ])
    for (const line of [-1, 0.5]) {
      let error
      try {
        new SourceMapConsumer({ version: 3, sections: [{ offset: { line, column: 0 }, map: generator.toJSON() }] })
      } catch (caught) {
        error = caught
      }
      expect({ name: error?.name, message: error?.message }).toEqual({
        name: "Error",
        message: "Section offset line and column must be non-negative integers.",
      })
    }
  }
})

test("both Express proxy owners return exact ordinary and mapped client identities", () => {
  const search = createRequire(require.resolve("open-websearch/build/engines/bing/bing.js"))
  const sdk = createRequire(require.resolve("@modelcontextprotocol/sdk/server/streamableHttp.js"))
  for (const expressPath of [sdk.resolve("express"), search.resolve("express")]) {
    const proxyaddr = createRequire(expressPath)("proxy-addr")
    const req = (address: string) => ({ socket: { remoteAddress: address }, headers: { "x-forwarded-for": "9.9.9.9" } })
    expect([
      proxyaddr(req("10.0.0.1"), ["10.0.0.0/8"]),
      proxyaddr(req("::ffff:10.0.0.1"), ["::ffff:10.0.0.0/104"]),
      proxyaddr(req("127.0.0.1"), ["::ffff:10.0.0.0/8"]),
      proxyaddr(req("::ffff:8.8.8.8"), ["::ffff:10.0.0.0/8"]),
    ]).toEqual(["9.9.9.9", "9.9.9.9", "127.0.0.1", "::ffff:8.8.8.8"])
  }
})
