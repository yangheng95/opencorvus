import { expect, test } from "bun:test"
import nodefs from "node:fs"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  artifactEmbeddedExecutablePaths,
  discoverArtifactBinaryPaths,
  inspectArtifactExecutableClosure,
  normalizeArtifactExecutablePermissions,
} from "../../script/runtime-executable-contract"
import { artifactEntrypoints } from "../../script/build-artifact"

test("standalone build owns one launcher entrypoint with its inspector child path bundled by import", () => {
  expect({
    cli: artifactEntrypoints("cli"),
    overlay: artifactEntrypoints("overlay-server"),
  }).toEqual({
    cli: ["./src/launcher.ts"],
    overlay: ["./src/overlay-launcher.ts"],
  })
})

test("runtime executable discovery reads native binaries below a namespaced long path", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-contract-"))
  const deepDirectory = path.join(root, ...Array.from({ length: 12 }, (_, index) => `payload-segment-${index}-abcdef`))
  const magicBinary = path.join(deepDirectory, "runtime-binary")
  const extensionBinary = path.join(deepDirectory, "native-addon.node")

  try {
    await fs.mkdir(path.toNamespacedPath(deepDirectory), { recursive: true })
    await fs.writeFile(path.toNamespacedPath(magicBinary), Buffer.from([0x4d, 0x5a, 0, 0]))
    await fs.writeFile(path.toNamespacedPath(extensionBinary), Buffer.from("native addon"))

    expect(await discoverArtifactBinaryPaths(root)).toEqual([extensionBinary, magicBinary].sort((a, b) => a.localeCompare(b)))
  } finally {
    await fs.rm(path.toNamespacedPath(root), { recursive: true, force: true })
  }
})

test("runtime executable discovery retries one transient artifact visibility gap", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-contract-"))
  const candidate = path.join(root, "runtime.js")
  await fs.writeFile(candidate, "export {}")
  const originalOpen = nodefs.promises.open
  let attempts = 0
  nodefs.promises.open = (async (...args: Parameters<typeof nodefs.promises.open>) => {
    if (String(args[0]) === path.toNamespacedPath(candidate) && attempts++ === 0) {
      const error = new Error("transient artifact visibility gap") as NodeJS.ErrnoException
      error.code = "ENOENT"
      throw error
    }
    return originalOpen(...args)
  }) as typeof nodefs.promises.open
  try {
    await expect(discoverArtifactBinaryPaths(root)).resolves.toEqual([])
    expect(attempts).toBe(2)
  } finally {
    nodefs.promises.open = originalOpen
    await fs.rm(path.toNamespacedPath(root), { recursive: true, force: true })
  }
})

test("Windows permission normalization validates the complete embedded executable set", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-contract-"))
  const executables = artifactEmbeddedExecutablePaths(root, "win32")
  for (const executable of executables) {
    await fs.mkdir(path.dirname(executable), { recursive: true })
    await fs.writeFile(executable, Buffer.from([0x4d, 0x5a, 0, 0]))
  }
  try {
    const normalized = await normalizeArtifactExecutablePermissions({ root, os: "win32" })
    expect(normalized).toEqual(executables.toSorted((left, right) => left.localeCompare(right)))
    await expect(Promise.all(normalized.map((executable) => fs.stat(executable).then((entry) => entry.isFile())))).resolves.toEqual(
      normalized.map(() => true),
    )
  } finally {
    await fs.rm(path.toNamespacedPath(root), { recursive: true, force: true })
  }
})

test.skipIf(process.platform === "win32")(
  "POSIX permission normalization keeps executables 0755 and shared libraries 0644",
  async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-contract-"))
  const explicit = artifactEmbeddedExecutablePaths(root, "linux")
  const sharedLibrary = path.join(root, "native", "renderer.node")
  const dataFile = path.join(root, "data", "runtime.json")
  try {
    for (const executable of explicit) {
      await fs.mkdir(path.dirname(executable), { recursive: true })
      await fs.writeFile(executable, Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
      await fs.chmod(executable, 0o600)
    }
    await fs.mkdir(path.dirname(sharedLibrary), { recursive: true })
    await fs.writeFile(sharedLibrary, Buffer.from([0x7f, 0x45, 0x4c, 0x46]))
    await fs.chmod(sharedLibrary, 0o755)
    await fs.mkdir(path.dirname(dataFile), { recursive: true })
    await fs.writeFile(dataFile, "{}")
    await fs.chmod(dataFile, 0o777)

    await normalizeArtifactExecutablePermissions({ root, os: "linux" })
    const closure = await inspectArtifactExecutableClosure({ root, os: "linux" })
    expect(
      closure.map((file) => ({
        path: path.relative(root, file.path).replaceAll("\\", "/"),
        kind: file.kind,
        mode: file.mode,
      })),
    ).toEqual([
      ...explicit.map((file) => ({
        path: path.relative(root, file).replaceAll("\\", "/"),
        kind: "executable" as const,
        mode: 0o755,
      })),
      { path: "native/renderer.node", kind: "shared_library", mode: 0o644 },
    ].sort((left, right) => left.path.localeCompare(right.path)))
    expect({
      root: (await fs.stat(root)).mode & 0o777,
      dataDirectory: (await fs.stat(path.dirname(dataFile))).mode & 0o777,
      dataFile: (await fs.stat(dataFile)).mode & 0o777,
    }).toEqual({ root: 0o755, dataDirectory: 0o755, dataFile: 0o644 })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
  },
)
