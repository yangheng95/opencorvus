import { describe, expect, test } from "bun:test"

import { releaseVersionMetadata, synchronizeTauriConfig } from "./sync-version"

describe("release version metadata", () => {
  test("projects stable, semantic prerelease, and compact product versions to GitHub release metadata", () => {
    expect(releaseVersionMetadata("0.0.35")).toEqual({ version: "0.0.35", prerelease: false })
    expect(releaseVersionMetadata("v0.0.35-beta.4")).toEqual({ version: "0.0.35-beta.4", prerelease: true })
    expect(releaseVersionMetadata("v0.0.38beta")).toEqual({ version: "0.0.38-beta", prerelease: true })
  })
})

describe("Tauri release projection", () => {
  test("projects a stable version and replaces endpoint drift with the single stable channel", () => {
    const input = JSON.stringify({
      version: "0.0.45-beta",
      plugins: {
        updater: {
          endpoints: [
            "https://github.com/yangheng95/opencorvus/releases/download/desktop-update-beta/latest.json",
            "https://example.invalid/extra.json",
          ],
        },
      },
      bundle: { windows: { wix: { version: "0.0.45.0" } } },
    })

    expect(JSON.parse(synchronizeTauriConfig(input, "0.0.46", "yangheng95/opencorvus"))).toMatchObject({
      version: "0.0.46",
      plugins: {
        updater: {
          endpoints: [
            "https://github.com/yangheng95/opencorvus/releases/download/desktop-update-stable/latest.json",
          ],
        },
      },
      bundle: { windows: { wix: { version: "0.0.46" } } },
    })
  })
})
