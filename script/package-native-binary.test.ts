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
  nativeBinarySmokeCommands,
  runNativeBinarySmokeCommand,
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

test("native binary smoke applies the locked OfficeCLI non-resident update policy", () => {
  const bundleDir = path.resolve("native-output", "opencorvus-linux-x64")
  const commands = nativeBinarySmokeCommands(
    {
      id: "opencorvus-linux-x64",
      bundleDir,
      executable: path.join(bundleDir, "opencorvus"),
      archive: path.resolve("native-output", "opencorvus-linux-x64.tar.gz"),
    },
    "linux",
    "x64",
  )

  expect(commands.find((command) => command.label === "officecli")?.env).toEqual({
    OFFICECLI_NO_AUTO_RESIDENT: "1",
    OFFICECLI_SKIP_UPDATE: "1",
  })
})

test("native binary smoke executes with locked policy over the inherited environment", async () => {
  const output = await runNativeBinarySmokeCommand(
    {
      label: "officecli",
      argv: [
        process.execPath,
        "-e",
        "console.log(JSON.stringify({ caller: process.env.CALLER_FACT, resident: process.env.OFFICECLI_NO_AUTO_RESIDENT, update: process.env.OFFICECLI_SKIP_UPDATE }))",
      ],
      env: {
        OFFICECLI_NO_AUTO_RESIDENT: "1",
        OFFICECLI_SKIP_UPDATE: "1",
      },
    },
    {
      ...process.env,
      CALLER_FACT: "retained",
      OFFICECLI_NO_AUTO_RESIDENT: "caller",
      OFFICECLI_SKIP_UPDATE: "caller",
    },
  )

  expect(JSON.parse(output)).toEqual({ caller: "retained", resident: "1", update: "1" })
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
