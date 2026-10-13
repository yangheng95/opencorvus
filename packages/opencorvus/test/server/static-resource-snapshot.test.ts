import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { OVERLAY_UI_IDENTITY_HEADER, OverlayUI, freezeOverlayUiDirectory } from "../../src/server/overlay-ui"

const roots: string[] = []
const servers: Array<ReturnType<typeof Bun.serve>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop(true)))
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

// Opaque transport payloads. These are never executed or rendered as a UI.
async function resources() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-static-snapshot-"))
  roots.push(root)
  const directory = path.join(root, "published")
  const entries = [
    ["assets/late.mjs", new Uint8Array([0, 1, 2, 255])],
    ["i18n/en.json", new Uint8Array([3, 4, 5])],
    ["licenses/NOTICE.txt", new Uint8Array([6, 7, 8])],
    ["assets/资料 100%.bin", new Uint8Array([9, 10, 11])],
  ] as const
  for (const [relative, bytes] of entries) {
    const file = path.join(directory, relative)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, bytes)
  }
  await fs.writeFile(path.join(directory, "index.html"), "")
  return { root, directory, entries }
}

function listen(source: ReturnType<typeof freezeOverlayUiDirectory>) {
  const app = OverlayUI.routes(source)
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
  servers.push(server)
  return server.url
}

async function response(origin: URL, relative: string) {
  const result = await fetch(new URL(`/ui/${relative}`, origin))
  return {
    status: result.status,
    identity: result.headers.get(OVERLAY_UI_IDENTITY_HEADER),
    type: result.headers.get("content-type"),
    bytes: new Uint8Array(await result.arrayBuffer()),
  }
}

test("captured resources retain exact transport bytes after the published directory is removed", async () => {
  const { root, directory, entries } = await resources()
  const source = freezeOverlayUiDirectory({ directory })
  const origin = listen(source)
  await fs.rename(directory, path.join(root, "retired"))
  for (const [relative, bytes] of entries) {
    const result = await response(origin, encodeURI(relative))
    expect({ status: result.status, identity: result.identity, bytes: result.bytes }).toEqual({ status: 200, identity: source.identity, bytes })
  }
  expect(source.assetCount).toBe(5)
})

test("independent captures of one published path serve their own complete bytes", async () => {
  const { directory, entries } = await resources()
  const first = freezeOverlayUiDirectory({ directory })
  const firstOrigin = listen(first)
  for (const [relative] of entries) await fs.writeFile(path.join(directory, relative), new Uint8Array([32, 33, 34]))
  const second = freezeOverlayUiDirectory({ directory })
  const secondOrigin = listen(second)
  for (const [relative, firstBytes] of entries) {
    const current = await response(secondOrigin, encodeURI(relative))
    expect({ status: current.status, identity: current.identity, bytes: current.bytes }).toEqual({ status: 200, identity: second.identity, bytes: new Uint8Array([32, 33, 34]) })
    const original = await response(firstOrigin, encodeURI(relative))
    expect({ status: original.status, identity: original.identity, bytes: original.bytes }).toEqual({ status: 200, identity: first.identity, bytes: firstBytes })
  }
})

test("newly published resource names receive the original source's explicit missing-resource response", async () => {
  const { directory } = await resources()
  const origin = listen(freezeOverlayUiDirectory({ directory }))
  await fs.writeFile(path.join(directory, "assets/new.bin"), new Uint8Array([42]))
  const result = await response(origin, "assets/new.bin")
  expect({ status: result.status, bytes: result.bytes }).toEqual({ status: 404, bytes: new TextEncoder().encode("Not Found") })
})

test("concurrent and subsequent responses each receive the complete captured resource", async () => {
  const { directory, entries } = await resources()
  const source = freezeOverlayUiDirectory({ directory })
  const origin = listen(source)
  const [relative, bytes] = entries[0]
  const parallel = await Promise.all(Array.from({ length: 3 }, () => response(origin, relative)))
  const sequential = [await response(origin, relative), await response(origin, relative)]
  for (const result of [...parallel, ...sequential]) {
    expect({ status: result.status, identity: result.identity, bytes: result.bytes }).toEqual({ status: 200, identity: source.identity, bytes })
    expect(result.type).toBe("application/javascript; charset=utf-8")
  }
})

test("resource URLs retain Unicode, spaces and literal percent filename identity", async () => {
  const { directory, entries } = await resources()
  const origin = listen(freezeOverlayUiDirectory({ directory }))
  const [relative, bytes] = entries[3]
  const result = await response(origin, encodeURI(relative))
  expect({ status: result.status, bytes: result.bytes }).toEqual({ status: 200, bytes })
})

test.each(["assets/%00.bin", "assets/..%5Coutside.bin", "assets/%"])("invalid resource URL %s has the forbidden response contract", async (relative) => {
  const { directory } = await resources()
  const origin = listen(freezeOverlayUiDirectory({ directory }))
  const result = await response(origin, relative)
  expect({ status: result.status, bytes: result.bytes }).toEqual({ status: 403, bytes: new TextEncoder().encode("Forbidden") })
})

test("capture rejects a directory link to resources outside the published root", async () => {
  const { root, directory } = await resources()
  const outside = path.join(root, "outside")
  await fs.mkdir(outside)
  await fs.writeFile(path.join(outside, "private.bin"), new Uint8Array([51]))
  const link = path.join(directory, "linked")
  await fs.symlink(outside, link, process.platform === "win32" ? "junction" : "dir")
  expect(() => freezeOverlayUiDirectory({ directory })).toThrow(`Overlay UI static resource resolves outside its frozen directory: ${link}`)
})

test("a declared resource manifest and required directories retain the complete captured response", async () => {
  const { directory } = await resources()
  const bytes = new Uint8Array([41, 42, 43])
  await fs.writeFile(path.join(directory, "assets/secondary.mjs"), bytes)
  await fs.writeFile(path.join(directory, ".manifest.json"), JSON.stringify({
    entry: { file: "assets/late.mjs", dynamicImports: ["secondary"] },
    secondary: { file: "assets/secondary.mjs" },
  }))
  const source = freezeOverlayUiDirectory({ directory, manifestPath: ".manifest.json", requiredStaticDirectories: ["i18n", "licenses"] })
  const result = await response(listen(source), "assets/secondary.mjs")
  expect({ status: result.status, identity: result.identity, bytes: result.bytes }).toEqual({ status: 200, identity: source.identity, bytes })
  expect(source.assetCount).toBe(7)
})

test("a missing declared dependency returns the capture error contract", async () => {
  const { directory } = await resources()
  await fs.writeFile(path.join(directory, ".manifest.json"), JSON.stringify({
    entry: { file: "assets/late.mjs", dynamicImports: ["secondary"] },
  }))
  expect(() => freezeOverlayUiDirectory({ directory, manifestPath: ".manifest.json" }))
    .toThrow("Overlay UI manifest entry entry references missing chunk secondary")
})
