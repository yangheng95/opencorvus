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

  test("computes one packaged sidecar directory and executable", () => {
    const paths = packagedNodeRuntimePaths({ execPath: "C:\\app\\opencorvus.exe", platform: "win32" })
    expect(paths).toEqual({
      directory: path.join("C:\\app", "browser-mcp-node"),
      nodeExecutable: path.join("C:\\app", "browser-mcp-node", "node.exe"),
    })
    expect(nodeExecutableName("linux")).toBe("node")
    expect(isBunExecutable("C:\\tools\\bun.exe")).toBe(true)
  })
})
