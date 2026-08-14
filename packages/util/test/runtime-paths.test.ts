import { describe, expect, test } from "bun:test"
import path from "node:path"
import { OpenCorvusTestRuntimeIsolationError, resolveOpenCorvusRuntimePaths } from "../src/runtime-paths"

describe("OpenCorvus test runtime paths", () => {
  test("resolves a test runtime only inside its preload-owned process root", () => {
    const processRoot = path.resolve("test-runtime-process")
    const runtimeRoot = path.join(processRoot, "runtime")
    expect(
      resolveOpenCorvusRuntimePaths({
        env: {
          OPENCORVUS_HOME: runtimeRoot,
          OPENCORVUS_TEST_HOME: path.join(processRoot, "home"),
          OPENCORVUS_TEST_PROCESS_ROOT: processRoot,
        },
        platform: process.platform,
        home: path.join(processRoot, "home"),
      }).root,
    ).toBe(runtimeRoot)
  })

  test("returns a typed isolation error for a test home without preload authority", () => {
    expect(() =>
      resolveOpenCorvusRuntimePaths({
        env: { OPENCORVUS_TEST_HOME: path.resolve("test-home") },
        platform: process.platform,
        home: path.resolve("test-home"),
      }),
    ).toThrow(OpenCorvusTestRuntimeIsolationError)
  })

  test("returns a typed isolation error for a production runtime outside the test process root", () => {
    const processRoot = path.resolve("test-runtime-process")
    expect(() =>
      resolveOpenCorvusRuntimePaths({
        env: {
          OPENCORVUS_HOME: path.resolve("production-runtime"),
          OPENCORVUS_TEST_HOME: path.join(processRoot, "home"),
          OPENCORVUS_TEST_PROCESS_ROOT: processRoot,
        },
        platform: process.platform,
        home: path.join(processRoot, "home"),
      }),
    ).toThrow(OpenCorvusTestRuntimeIsolationError)
  })
})
