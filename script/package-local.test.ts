import { describe, expect, test } from "bun:test"
import path from "node:path"
import { localBundleTargets, localCargoTarget, localTauriBundleConfig } from "./package-local"

describe("local package host contract", () => {
  test("selects native Windows installer kinds and an unsigned local updater contract", () => {
    expect(localBundleTargets("win32")).toEqual(["msi", "nsis"])
    expect(localTauriBundleConfig()).toEqual({
      build: { beforeBuildCommand: null },
      bundle: { resources: [], createUpdaterArtifacts: false },
    })
  })

  test("reports the exact isolated Cargo target selected for a live-client-safe package", () => {
    expect(localCargoTarget("D:\\repo", { CARGO_TARGET_DIR: "D:\\package-target" })).toBe(
      path.resolve("D:\\package-target"),
    )
    expect(localCargoTarget("D:\\repo", { CARGO_TARGET_DIR: "isolated-target" })).toBe(
      path.resolve("D:\\repo", "isolated-target"),
    )
    expect(localCargoTarget("D:\\repo", {})).toBe(path.join("D:\\repo", "packages", "overlay", "src-tauri", "target"))
  })
})
