import { describe, expect, test } from "bun:test"

import { generateWebsiteDownloadManifest } from "./generate-website-download-manifest"
import { cliArchiveNames, overlayBundlePatterns } from "./release-asset-contract"

function release(version: string, publishedAt: string) {
  const repository = "https://github.com/yangheng95/opencorvus"
  const assets = [
    ...["windows-x64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"].flatMap((platform) =>
      overlayBundlePatterns(platform, version).map(({ assetName, pattern, label }) => {
        const name =
          assetName ??
          ({
            "Windows MSI bundle": `OpenCorvus_${version}_x64_en-US.msi`,
            "Windows NSIS bundle": `OpenCorvus_${version}_x64-setup.exe`,
            "macOS DMG bundle": `OpenCorvus_${version}_${platform === "darwin-x64" ? "x64" : "aarch64"}.dmg`,
            "Linux AppImage bundle": `OpenCorvus_${version}_${platform === "linux-x64" ? "amd64" : "aarch64"}.AppImage`,
            "Linux DEB bundle": `OpenCorvus_${version}_${platform === "linux-x64" ? "amd64" : "arm64"}.deb`,
            "Linux RPM bundle": `OpenCorvus-${version}-1.${platform === "linux-x64" ? "x86_64" : "aarch64"}.rpm`,
          }[label] as string)
        expect(pattern.test(name)).toBe(true)
        return name
      }),
    ),
    ...["windows-x64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"].flatMap(cliArchiveNames),
  ].map((name, index) => ({
    name,
    size: 1_000_000 + index,
    browser_download_url: `${repository}/releases/download/v${version}/${name}`,
  }))
  return {
    tag_name: `v${version}`,
    draft: false,
    prerelease: version.includes("-"),
    published_at: publishedAt,
    html_url: `${repository}/releases/tag/v${version}`,
    assets,
  }
}

describe("website download manifest", () => {
  test("projects the highest published release into complete deterministic desktop and CLI downloads", () => {
    const older = release("0.0.37", "2026-08-08T01:00:00Z")
    const current = release("0.0.38-beta", "2026-08-09T07:43:43Z")
    const manifest = generateWebsiteDownloadManifest([older, current], "0.0.37")

    expect(manifest).toMatchObject({
      protocol: "opencorvus/website-downloads@1",
      version: "0.0.38-beta",
      publishedAt: "2026-08-09T07:43:43.000Z",
      releaseUrl: "https://github.com/yangheng95/opencorvus/releases/tag/v0.0.38-beta",
      prerelease: true,
    })
    expect(manifest.assets).toHaveLength(18)
    expect(manifest.assets.slice(0, 5).map(({ id }) => id)).toEqual([
      "desktop-windows-x64-msi",
      "desktop-windows-x64-exe",
      "desktop-macos-x64-dmg",
      "desktop-macos-arm64-dmg",
      "desktop-linux-x64-appimage",
    ])
    expect(manifest.assets.filter(({ product }) => product === "desktop")).toHaveLength(10)
    expect(manifest.assets.filter(({ product }) => product === "cli")).toHaveLength(8)
    expect(manifest.assets.filter(({ compatible }) => compatible).map(({ id }) => id)).toEqual([
      "cli-windows-x64-tar-gz-compatible",
      "cli-macos-x64-tar-gz-compatible",
      "cli-linux-x64-tar-gz-compatible",
    ])
    for (const asset of manifest.assets) {
      expect(asset.bytes).toBeGreaterThan(0)
      expect(asset.url).toContain("/releases/download/v0.0.38-beta/")
    }
  })

  test("reports an unpublished dispatch and an incomplete selected release precisely", () => {
    const current = release("0.0.38-beta", "2026-08-09T07:43:43Z")
    expect(() => generateWebsiteDownloadManifest([current], "0.0.39-beta")).toThrow(
      "Dispatched Release is not published: v0.0.39-beta",
    )
    current.assets = current.assets.filter(({ name }) => name !== "OpenCorvus_0.0.38-beta_x64-setup.exe")
    expect(() => generateWebsiteDownloadManifest([current])).toThrow(
      "Windows NSIS bundle for windows-x64 must resolve to exactly one Release asset; found 0",
    )
  })
})
