import { describe, expect, test } from "bun:test"
import { cliArchiveNames, overlayBundlePatterns } from "./release-asset-contract"

describe("Overlay release asset contract", () => {
  test("maps the Linux ARM64 native bundle filenames produced by Tauri", () => {
    const patterns = overlayBundlePatterns("linux-arm64", "0.0.35-beta")
    const produced = [
      "OpenCorvus_0.0.35-beta_aarch64.AppImage",
      "OpenCorvus_0.0.35-beta_arm64.deb",
      "OpenCorvus-0.0.35-beta-1.aarch64.rpm",
    ]

    expect(patterns.map((item) => item.label)).toEqual([
      "Linux AppImage bundle",
      "Linux DEB bundle",
      "Linux RPM bundle",
    ])
    expect(patterns.map((item, index) => item.pattern.test(produced[index]!))).toEqual([true, true, true])
  })

  test("maps each native CLI row to its complete archive set", () => {
    expect(
      Object.fromEntries(
        ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"].map((platform) => [
          platform,
          cliArchiveNames(platform),
        ]),
      ),
    ).toEqual({
      "linux-x64": ["opencorvus-linux-x64.tar.gz", "opencorvus-linux-x64-baseline.tar.gz"],
      "linux-arm64": ["opencorvus-linux-arm64.tar.gz"],
      "darwin-x64": ["opencorvus-darwin-x64.tar.gz", "opencorvus-darwin-x64-baseline.tar.gz"],
      "darwin-arm64": ["opencorvus-darwin-arm64.tar.gz"],
      "windows-x64": ["opencorvus-windows-x64.tar.gz", "opencorvus-windows-x64-baseline.tar.gz"],
    })
  })
})
