import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { desktopUpdateChannel, desktopUpdateChannelTag, desktopUpdateEndpoint } from "./desktop-update-channel"
import { generateDesktopUpdateManifest } from "./generate-desktop-update-manifest"

describe("desktop update publication contract", () => {
  test("checked-in desktop client uses the published trust root and synchronized beta endpoint", async () => {
    const tauriConfig = JSON.parse(
      await fs.readFile(path.resolve("packages/overlay/src-tauri/tauri.conf.json"), "utf8"),
    ) as { version: string; plugins: { updater: { pubkey: string; endpoints: string[]; windows: { installMode: string } } } }

    expect(tauriConfig.plugins.updater).toEqual({
      pubkey:
        "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDk0QUIwNTE1MjY3MTZBRTIKUldUaWFuRW1GUVdybExYQmhlUDlUQzY2TGs5cG8zUk5TZ3lnenQ3Q3M4eHhoNHl0dm0rREl0SzAK",
      endpoints: [desktopUpdateEndpoint("yangheng95/opencorvus", tauriConfig.version)],
      windows: { installMode: "passive" },
    })
  })

  test("maps semantic release versions to exact immutable channel endpoints", () => {
    expect({
      beta: {
        channel: desktopUpdateChannel("0.0.36-beta"),
        tag: desktopUpdateChannelTag("beta"),
        endpoint: desktopUpdateEndpoint("yangheng95/opencorvus", "0.0.36-beta"),
      },
      stable: {
        channel: desktopUpdateChannel("1.0.0"),
        tag: desktopUpdateChannelTag("stable"),
        endpoint: desktopUpdateEndpoint("yangheng95/opencorvus", "1.0.0"),
      },
    }).toEqual({
      beta: {
        channel: "beta",
        tag: "desktop-update-beta",
        endpoint: "https://github.com/yangheng95/opencorvus/releases/download/desktop-update-beta/latest.json",
      },
      stable: {
        channel: "stable",
        tag: "desktop-update-stable",
        endpoint: "https://github.com/yangheng95/opencorvus/releases/download/desktop-update-stable/latest.json",
      },
    })
  })

  test("builds a complete five-platform manifest from exact signed release assets", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-desktop-update-"))
    const bundles = [
      "OpenCorvus_0.0.36-beta_amd64.AppImage",
      "OpenCorvus_0.0.36-beta_aarch64.AppImage",
      "OpenCorvus_0.0.36-beta_x64.app.tar.gz",
      "OpenCorvus_0.0.36-beta_aarch64.app.tar.gz",
      "OpenCorvus_0.0.36-beta_x64-setup.exe",
    ]
    await Promise.all(
      bundles.flatMap((bundle, index) => [
        fs.writeFile(path.join(directory, bundle), `bundle-${index}`),
        fs.writeFile(path.join(directory, `${bundle}.sig`), `signature-${index}\n`),
      ]),
    )

    try {
      const manifest = await generateDesktopUpdateManifest({
        directory,
        version: "0.0.36-beta",
        repository: "yangheng95/opencorvus",
        publicationDate: "2026-08-08T12:00:00.000Z",
        notes: "Signed desktop update",
      })
      expect(manifest).toEqual({
        version: "0.0.36-beta",
        notes: "Signed desktop update",
        pub_date: "2026-08-08T12:00:00.000Z",
        platforms: {
          "linux-x86_64": {
            url: "https://github.com/yangheng95/opencorvus/releases/download/v0.0.36-beta/OpenCorvus_0.0.36-beta_amd64.AppImage",
            signature: "signature-0",
          },
          "linux-aarch64": {
            url: "https://github.com/yangheng95/opencorvus/releases/download/v0.0.36-beta/OpenCorvus_0.0.36-beta_aarch64.AppImage",
            signature: "signature-1",
          },
          "darwin-x86_64": {
            url: "https://github.com/yangheng95/opencorvus/releases/download/v0.0.36-beta/OpenCorvus_0.0.36-beta_x64.app.tar.gz",
            signature: "signature-2",
          },
          "darwin-aarch64": {
            url: "https://github.com/yangheng95/opencorvus/releases/download/v0.0.36-beta/OpenCorvus_0.0.36-beta_aarch64.app.tar.gz",
            signature: "signature-3",
          },
          "windows-x86_64": {
            url: "https://github.com/yangheng95/opencorvus/releases/download/v0.0.36-beta/OpenCorvus_0.0.36-beta_x64-setup.exe",
            signature: "signature-4",
          },
        },
      })
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  /**
   * A Release that shipped without a platform still describes the ones it has.
   * On v0.0.47-beta a single runner's apt install stalled, and refusing the
   * manifest over the missing AppImage discarded nine finished platform builds
   * and published nothing. A client on the absent platform sees no update;
   * every other client still gets one.
   */
  test("omits a platform that did not build and still describes the rest", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-desktop-update-partial-"))
    const bundles = [
      "OpenCorvus_0.0.36-beta_aarch64.AppImage",
      "OpenCorvus_0.0.36-beta_x64.app.tar.gz",
      "OpenCorvus_0.0.36-beta_x64-setup.exe",
    ]
    await Promise.all(
      bundles.flatMap((bundle, index) => [
        fs.writeFile(path.join(directory, bundle), `bundle-${index}`),
        fs.writeFile(path.join(directory, `${bundle}.sig`), `signature-${index}\n`),
      ]),
    )

    try {
      const manifest = await generateDesktopUpdateManifest({
        directory,
        version: "0.0.36-beta",
        repository: "yangheng95/opencorvus",
        publicationDate: "2026-08-08T12:00:00.000Z",
      })
      expect(Object.keys(manifest.platforms).sort()).toEqual(["darwin-x86_64", "linux-aarch64", "windows-x86_64"])
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })

  test("refuses a staging directory holding no overlay bundle at all", async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-desktop-update-empty-"))
    try {
      await expect(
        generateDesktopUpdateManifest({
          directory,
          version: "0.0.36-beta",
          repository: "yangheng95/opencorvus",
          publicationDate: "2026-08-08T12:00:00.000Z",
        }),
      ).rejects.toThrow(/found no overlay bundle/)
    } finally {
      await fs.rm(directory, { recursive: true, force: true })
    }
  })
})
