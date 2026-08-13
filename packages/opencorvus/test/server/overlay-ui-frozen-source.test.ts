import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  OVERLAY_UI_IDENTITY_HEADER,
  OVERLAY_UI_SOURCE_HEADER,
  OverlayUI,
  freezeOverlayUiDirectory,
} from "../../src/server/overlay-ui"

const temporaryDirectories: string[] = []
const servers: Array<ReturnType<typeof Bun.serve>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop(true)))
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function createOverlayFixture(label: string) {
  const directory = await mkdtemp(path.join(os.tmpdir(), `opencorvus-frozen-overlay-${label}-`))
  temporaryDirectories.push(directory)
  await Promise.all([
    mkdir(path.join(directory, "assets"), { recursive: true }),
    mkdir(path.join(directory, "i18n"), { recursive: true }),
    mkdir(path.join(directory, "licenses"), { recursive: true }),
  ])
  await Promise.all([
    writeFile(
      path.join(directory, "index.html"),
      `<html><head><link rel="stylesheet" href="./assets/main-${label}.css"></head>` +
        `<body><script type="module" src="./assets/main-${label}.js"></script></body></html>`,
      "utf8",
    ),
    writeFile(
      path.join(directory, "assets", `main-${label}.js`),
      `globalThis.overlayBuild = ${JSON.stringify(label)}`,
      "utf8",
    ),
    writeFile(
      path.join(directory, "assets", `main-${label}.css`),
      `:root{--overlay-build:${JSON.stringify(label)}}`,
      "utf8",
    ),
    writeFile(path.join(directory, "i18n", "en.json"), JSON.stringify({ label }), "utf8"),
    writeFile(path.join(directory, "licenses", "NOTICE.txt"), `license-${label}`, "utf8"),
    writeFile(
      path.join(directory, ".opencorvus-overlay-manifest.json"),
      JSON.stringify({
        "index.html": {
          file: `assets/main-${label}.js`,
          css: [`assets/main-${label}.css`],
          assets: [],
          imports: [],
          dynamicImports: [],
        },
      }),
      "utf8",
    ),
  ])
  return directory
}

describe("frozen Overlay UI source", () => {
  test("serves one validated per-run bundle over a real random-port HTTP listener", async () => {
    const directory = await createOverlayFixture("alpha")
    const source = freezeOverlayUiDirectory({
      directory,
      manifestPath: ".opencorvus-overlay-manifest.json",
      requiredStaticDirectories: ["i18n", "licenses"],
    })
    const app = OverlayUI.routes(source)
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
    servers.push(server)

    const indexResponse = await fetch(new URL("/ui/", server.url))
    const indexHtml = await indexResponse.text()
    expect(indexResponse.status).toBe(200)
    expect(indexResponse.headers.get(OVERLAY_UI_SOURCE_HEADER)).toBe("directory")
    expect(indexResponse.headers.get(OVERLAY_UI_IDENTITY_HEADER)).toBe(source.identity)
    expect(indexHtml).toContain("./assets/main-alpha.js")

    const scriptResponse = await fetch(new URL("/ui/assets/main-alpha.js", server.url))
    expect(scriptResponse.status).toBe(200)
    expect(scriptResponse.headers.get(OVERLAY_UI_IDENTITY_HEADER)).toBe(source.identity)
    expect(await scriptResponse.text()).toBe('globalThis.overlayBuild = "alpha"')
    expect(source.assetCount).toBe(6)
    expect(source.indexSHA256).toMatch(/^[a-f0-9]{64}$/)
    expect(source.manifestSHA256).toMatch(/^[a-f0-9]{64}$/)
    expect(source.assetClosureSHA256).toMatch(/^[a-f0-9]{64}$/)
  })

  test("keeps serving the captured bundle after a separate build completes", async () => {
    const firstDirectory = await createOverlayFixture("first")
    const firstSource = freezeOverlayUiDirectory({
      directory: firstDirectory,
      manifestPath: ".opencorvus-overlay-manifest.json",
      requiredStaticDirectories: ["i18n", "licenses"],
    })
    const app = OverlayUI.routes(firstSource)
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch })
    servers.push(server)

    const secondDirectory = await createOverlayFixture("second")
    const secondSource = freezeOverlayUiDirectory({
      directory: secondDirectory,
      manifestPath: ".opencorvus-overlay-manifest.json",
      requiredStaticDirectories: ["i18n", "licenses"],
    })

    const response = await fetch(new URL("/ui/assets/main-first.js", server.url))
    expect(response.status).toBe(200)
    expect(response.headers.get(OVERLAY_UI_IDENTITY_HEADER)).toBe(firstSource.identity)
    expect(await response.text()).toBe('globalThis.overlayBuild = "first"')
    expect(secondSource.identity).toMatch(/^directory:[a-f0-9]{64}$/)
  })
})
