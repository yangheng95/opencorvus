import { describe, expect, test } from "bun:test"
import path from "node:path"
import { localBuildEnvironment, localBundleTargets, localCargoTarget, localTauriBundleConfig } from "./package-local"

describe("local package host contract", () => {
  test("binds the sidecar version to desktop metadata and preserves the explicit Cargo target", () => {
    expect(localBuildEnvironment("D:\\repo", "0.1.10", { CARGO_TARGET_DIR: "target-local", PATH: "host-tools" })).toEqual({
      CARGO_TARGET_DIR: path.resolve("D:\\repo", "target-local"),
      PATH: "host-tools",
      OPENCORVUS_VERSION: "0.1.10",
      OPENCORVUS_CHANNEL: "local",
    })
    expect(() => localBuildEnvironment("D:\\repo", "0.1.10", { OPENCORVUS_VERSION: "0.1.9" })).toThrow(
      "Local package version must match desktop metadata 0.1.10; received 0.1.9",
    )
  })
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
