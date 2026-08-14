import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

type ProbeMode = "crash-before" | "crash-after" | "recover-before" | "recover-after"

function parseProbeOutput(stdout: string) {
  const outputLine = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)
  return JSON.parse(outputLine ?? "null") as {
    id: string
    expectedRevision: "before" | "after"
    packageDigest: string
    leftovers: string[]
  }
}

test("Registry discovery preserves an operator-owned partial target and rolls back Manager-owned partial scratch", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-package-interruption-before-"))
  const isolatedHome = path.join(isolatedRoot, "home")
  const isolatedProject = path.join(isolatedRoot, "project")
  const probe = path.join(import.meta.dir, "package-replacement-interruption-probe.ts")
  const spawn = (mode: ProbeMode) =>
    Bun.spawn([process.execPath, probe, mode, isolatedProject], {
      cwd: path.resolve(import.meta.dir, "../../../.."),
      env: { ...Bun.env, OPENCORVUS_HOME: isolatedHome },
      stdout: "pipe",
      stderr: "pipe",
    })

  try {
    const interrupted = spawn("crash-before")
    const [interruptedExit, interruptedError] = await Promise.all([
      interrupted.exited,
      new Response(interrupted.stderr).text(),
    ])
    expect(interruptedExit).toBe(1)
    expect(interruptedError).toContain("PackageMutationAbruptTerminationForTest")

    const scratch = path.join(isolatedProject, ".opencorvus", "expert-squad-staging")
    const partialTarget = path.join(
      isolatedProject,
      ".opencorvus",
      "expert-squads",
      "builtin",
      "cloud-platform-architecture",
    )
    await fs.mkdir(partialTarget, { recursive: true })
    await fs.writeFile(path.join(partialTarget, "README.md"), "Operator-owned invalid target bytes.\n")
    const blocked = spawn("recover-before")
    const [blockedExit, blockedError] = await Promise.all([blocked.exited, new Response(blocked.stderr).text()])
    expect(blockedExit).toBe(1)
    expect(blockedError).toContain("unknown interrupted filesystem state")
    expect(await fs.readFile(path.join(partialTarget, "README.md"), "utf8")).toBe(
      "Operator-owned invalid target bytes.\n",
    )
    await fs.rm(partialTarget, { recursive: true })

    const interruptedEntries = await fs.readdir(scratch)
    const stagingName = interruptedEntries.find((name) =>
      name.startsWith(".staging-builtin-cloud-platform-architecture-"),
    )
    if (!stagingName) throw new Error("Interrupted replacement did not retain its exact staging directory")
    await fs.rm(path.join(scratch, stagingName, "expert-squad.jsonc"))
    const journal = JSON.parse(
      await fs.readFile(path.join(scratch, ".package-replacement-cloud-platform-architecture.json"), "utf8"),
    ) as { discard: string }
    await fs.mkdir(journal.discard, { recursive: true })
    await fs.writeFile(path.join(journal.discard, "README.md"), "Partial Manager-owned discard cleanup.\n")

    const recovered = spawn("recover-before")
    const [recoveredExit, recoveredOutput, recoveredError] = await Promise.all([
      recovered.exited,
      new Response(recovered.stdout).text(),
      new Response(recovered.stderr).text(),
    ])
    if (recoveredExit !== 0)
      throw new Error(`Package interruption rollback failed (${recoveredExit}): ${recoveredError}`)

    expect(parseProbeOutput(recoveredOutput)).toEqual({
      id: "cloud-platform-architecture",
      expectedRevision: "before",
      packageDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      leftovers: [],
    })
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 180_000)

test("Registry discovery commits an exact replacement after interrupted backup cleanup becomes partial", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-package-interruption-after-"))
  const isolatedHome = path.join(isolatedRoot, "home")
  const isolatedProject = path.join(isolatedRoot, "project")
  const probe = path.join(import.meta.dir, "package-replacement-interruption-probe.ts")
  const spawn = (mode: ProbeMode) =>
    Bun.spawn([process.execPath, probe, mode, isolatedProject], {
      cwd: path.resolve(import.meta.dir, "../../../.."),
      env: { ...Bun.env, OPENCORVUS_HOME: isolatedHome },
      stdout: "pipe",
      stderr: "pipe",
    })

  try {
    const interrupted = spawn("crash-after")
    const [interruptedExit, interruptedError] = await Promise.all([
      interrupted.exited,
      new Response(interrupted.stderr).text(),
    ])
    expect(interruptedExit).toBe(1)
    expect(interruptedError).toContain("PackageMutationAbruptTerminationForTest")

    const scratch = path.join(isolatedProject, ".opencorvus", "expert-squad-staging")
    const backupName = (await fs.readdir(scratch)).find((name) =>
      name.startsWith(".replace-builtin-cloud-platform-architecture-"),
    )
    if (!backupName) throw new Error("Interrupted replacement did not retain its exact prior-revision backup")
    await fs.rm(path.join(scratch, backupName, "expert-squad.jsonc"))

    const recovered = spawn("recover-after")
    const [recoveredExit, recoveredOutput, recoveredError] = await Promise.all([
      recovered.exited,
      new Response(recovered.stdout).text(),
      new Response(recovered.stderr).text(),
    ])
    if (recoveredExit !== 0)
      throw new Error(`Package interruption commit recovery failed (${recoveredExit}): ${recoveredError}`)

    expect(parseProbeOutput(recoveredOutput)).toEqual({
      id: "cloud-platform-architecture",
      expectedRevision: "after",
      packageDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      leftovers: [],
    })
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 180_000)
