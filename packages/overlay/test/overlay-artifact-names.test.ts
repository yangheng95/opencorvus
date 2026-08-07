import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

import {
  overlayArchFromNode,
  overlayArchFromTriple,
  overlayExecutableFileName,
  overlayPackageName,
  overlayPlatformFromNode,
  overlayPlatformFromTriple,
  overlayServerDistName,
  overlayServerFileName,
} from "../script/artifact-names"

describe("overlay artifact names", () => {
  test("normalizes host platforms to opencorvus artifact names", () => {
    expect(overlayPlatformFromNode("win32")).toBe("windows")
    expect(overlayPlatformFromNode("darwin")).toBe("darwin")
    expect(overlayPlatformFromNode("linux")).toBe("linux")
    expect(() => overlayPlatformFromNode("freebsd")).toThrow("Unsupported overlay artifact platform")
  })

  test("normalizes Rust triples to opencorvus artifact names", () => {
    expect(overlayPlatformFromTriple("x86_64-pc-windows-msvc")).toBe("windows")
    expect(overlayPlatformFromTriple("aarch64-apple-darwin")).toBe("darwin")
    expect(overlayPlatformFromTriple("x86_64-unknown-linux-gnu")).toBe("linux")
    expect(overlayArchFromTriple("aarch64-unknown-linux-gnu")).toBe("arm64")
    expect(overlayArchFromTriple("x86_64-unknown-linux-gnu")).toBe("x64")
    expect(() => overlayPlatformFromTriple("x86_64-unknown-freebsd")).toThrow("Unsupported overlay target triple")
    expect(() => overlayArchFromTriple("i686-unknown-linux-gnu")).toThrow("Unsupported overlay target triple")
  })

  test("uses overlay-server artifact directory for embedded server payload", () => {
    expect(overlayArchFromNode("arm64")).toBe("arm64")
    expect(overlayArchFromNode("x64")).toBe("x64")
    expect(() => overlayArchFromNode("ia32")).toThrow("Unsupported overlay artifact arch")
    expect(overlayServerDistName("linux", "x64")).toBe("opencorvus-overlay-server-linux-x64")
    expect(overlayPackageName("linux", "x64")).toBe("opencorvus-overlay-linux-x64")
    expect(overlayServerFileName("windows")).toBe("opencorvus.exe")
    expect(overlayServerFileName("linux")).toBe("opencorvus")
    expect(overlayExecutableFileName("windows")).toBe("opencorvus-overlay.exe")
  })

  test("docker build script mounts the overlay-server artifact directory", () => {
    const script = readFileSync(join(import.meta.dir, "../script/build-docker.ts"), "utf8")
    expect(script).toContain("overlayServerDistName")
    expect(script).toContain("overlayServerFileName")
  })
})
