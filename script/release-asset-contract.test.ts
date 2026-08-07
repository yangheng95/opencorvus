import { describe, expect, test } from "bun:test"
import { overlayBundlePatterns } from "./release-asset-contract"

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
})
