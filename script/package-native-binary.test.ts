import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  finalizeNativeBinaryArtifact,
  nativeBinaryArchiveExtractionCommand,
  nativeBinaryArchiveListingCommand,
  nativeBinaryBuildCommands,
  nativeBinaryBuildEnv,
} from "./package-native-binary"

test("native binary build environment retains the selected release identity", () => {
  expect(nativeBinaryBuildEnv({ OPENCORVUS_CHANNEL: "latest" }, "0.0.37-beta")).toMatchObject({
    OPENCORVUS_CHANNEL: "latest",
    OPENCORVUS_VERSION: "0.0.37-beta",
  })
})

test("native binary build prepares the SDK before its overlay and CLI consumers", () => {
  const repoRoot = path.resolve("clean-native-binary-source")

  expect(nativeBinaryBuildCommands(repoRoot)).toEqual([
    {
      cwd: repoRoot,
      argv: ["bun", "packages/sdk/js/script/build.ts"],
    },
    {
      cwd: path.join(repoRoot, "packages", "overlay"),
      argv: ["bun", "run", "build:vite"],
    },
    {
      cwd: path.join(repoRoot, "packages", "opencorvus"),
      argv: ["bun", "run", "script/build.ts", "--single", "--baseline", "--no-clean"],
    },
  ])
})

test("native archive verification runs tar from the archive directory", () => {
  const archive = path.resolve("native-output", "opencorvus-windows-x64.tar.gz")

  expect(nativeBinaryArchiveListingCommand(archive)).toEqual({
    cwd: path.dirname(archive),
    argv: ["tar", "-tvzf", "opencorvus-windows-x64.tar.gz"],
  })

  const destination = path.resolve("native-output", "verified")
  expect(nativeBinaryArchiveExtractionCommand(archive, destination)).toEqual({
    cwd: path.dirname(archive),
    argv: ["tar", "-xzf", "opencorvus-windows-x64.tar.gz", "-C", destination],
  })
})

test("native finalization records the payload only after runtime smoke and signing", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-native-finalization-"))
  const payload = path.join(root, "runtime.bin")
  const manifest = path.join(root, "manifest.sha256")
  const events: string[] = []
  const digest = async () =>
    createHash("sha256")
      .update(await fs.readFile(payload))
      .digest("hex")
  try {
    await fs.writeFile(payload, "staged")
    await finalizeNativeBinaryArtifact({
      smoke: async () => {
        events.push("smoke")
        await fs.appendFile(payload, "-initialized")
      },
      sign: async () => {
        events.push("sign")
        await fs.appendFile(payload, "-signed")
      },
      writeManifest: async () => {
        events.push("manifest")
        await fs.writeFile(manifest, await digest())
      },
      writeStamp: async () => {
        events.push("stamp")
      },
      verify: async () => {
        events.push("verify")
        expect(await fs.readFile(manifest, "utf8")).toBe(await digest())
      },
    })
    expect(events).toEqual(["smoke", "sign", "manifest", "stamp", "verify"])
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})
