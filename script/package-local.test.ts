import { describe, expect, test } from "bun:test"
import { localBundleTargets, localTauriBundleConfig } from "./package-local"

describe("local package host contract", () => {
  test("selects native Windows installer kinds and an unsigned local updater contract", () => {
    expect(localBundleTargets("win32")).toEqual(["msi", "nsis"])
    expect(localTauriBundleConfig()).toEqual({
      build: { beforeBuildCommand: null },
      bundle: { resources: [], createUpdaterArtifacts: false },
    })
  })
})
