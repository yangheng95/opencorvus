import { describe, expect, test } from "bun:test"
import { cliArchiveNames, overlayBundlePatterns, overlayUpdaterContract } from "./release-asset-contract"

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

  test("maps every native GUI row to one signed Tauri updater artifact", () => {
    expect(
      Object.fromEntries(
        ["linux-x64", "linux-arm64", "darwin-x64", "darwin-arm64", "windows-x64"].map((platform) => {
          const contract = overlayUpdaterContract(platform, "0.0.36-beta")
          const produced = {
            "linux-x64": "OpenCorvus_0.0.36-beta_amd64.AppImage",
            "linux-arm64": "OpenCorvus_0.0.36-beta_aarch64.AppImage",
            "darwin-x64": "OpenCorvus_0.0.36-beta_x64.app.tar.gz",
            "darwin-arm64": "OpenCorvus_0.0.36-beta_aarch64.app.tar.gz",
            "windows-x64": "OpenCorvus_0.0.36-beta_x64-setup.exe",
          }[platform]!
          return [
            platform,
            { target: contract.target, bundle: produced, matched: contract.bundlePattern.test(produced) },
          ]
        }),
      ),
    ).toEqual({
      "linux-x64": {
        target: "linux-x86_64",
        bundle: "OpenCorvus_0.0.36-beta_amd64.AppImage",
        matched: true,
      },
      "linux-arm64": {
        target: "linux-aarch64",
        bundle: "OpenCorvus_0.0.36-beta_aarch64.AppImage",
        matched: true,
      },
      "darwin-x64": {
        target: "darwin-x86_64",
        bundle: "OpenCorvus_0.0.36-beta_x64.app.tar.gz",
        matched: true,
      },
      "darwin-arm64": {
        target: "darwin-aarch64",
        bundle: "OpenCorvus_0.0.36-beta_aarch64.app.tar.gz",
        matched: true,
      },
      "windows-x64": {
        target: "windows-x86_64",
        bundle: "OpenCorvus_0.0.36-beta_x64-setup.exe",
        matched: true,
      },
    })
  })
})
