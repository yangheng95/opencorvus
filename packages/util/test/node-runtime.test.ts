import { describe, expect, test } from "bun:test"
import path from "node:path"
import {
  isBunExecutable,
  nodeBinaryPackageName,
  nodeExecutableName,
  packagedNodeRuntimePaths,
} from "../src/node-runtime"

describe("shared Node sidecar paths", () => {
  test("maps supported host targets to the published Node binary packages", () => {
    expect(nodeBinaryPackageName("win32", "x64")).toBe("node-win-x64")
    expect(nodeBinaryPackageName("linux", "arm64")).toBe("node-linux-arm64")
    expect(nodeBinaryPackageName("darwin", "arm64")).toBe("node-bin-darwin-arm64")
    expect(() => nodeBinaryPackageName("win32", "arm64")).toThrow("does not support win32-arm64")
  })

  test("computes host-side package paths with each platform's executable name", () => {
    const packageDirectory = path.resolve("app with spaces")
    // The files live on the test host; platform selects the target basename.
    for (const [platform, executable, node] of [
      ["win32", "opencorvus.exe", "node.exe"],
      ["linux", "opencorvus", "node"],
      ["darwin", "opencorvus", "node"],
    ] as const) {
      expect(nodeExecutableName(platform)).toBe(node)
      for (const directoryName of [undefined, "custom-node"]) {
        expect(
          packagedNodeRuntimePaths({ execPath: path.join(packageDirectory, executable), platform, directoryName }),
        ).toEqual({
          directory: path.join(packageDirectory, directoryName ?? "browser-mcp-node"),
          nodeExecutable: path.join(packageDirectory, directoryName ?? "browser-mcp-node", node),
        })
      }
    }
  })

  test("resolves the default sidecar beside the running native executable", () => {
    const directory = path.join(path.dirname(process.execPath), "browser-mcp-node")
    expect(packagedNodeRuntimePaths()).toEqual({
      directory,
      nodeExecutable: path.join(directory, process.platform === "win32" ? "node.exe" : "node"),
    })
  })

  test("recognizes Bun executable basenames in host-native paths", () => {
    for (const name of ["bun", "bun.exe", "BUN.EXE"]) {
      expect(isBunExecutable(path.resolve("tools with spaces", name))).toBe(true)
    }
  })
})
