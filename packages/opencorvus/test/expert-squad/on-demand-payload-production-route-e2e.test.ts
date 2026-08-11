import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("production HTTP bootstrap exposes embedded defaults and installs one selected Market Squad", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-on-demand-payload-http-"))
  const isolatedHome = path.join(isolatedRoot, "home")
  const isolatedProject = path.join(isolatedRoot, "project")
  const probe = path.join(import.meta.dir, "on-demand-payload-production-route-probe.ts")

  try {
    const child = Bun.spawn([process.execPath, probe, isolatedProject], {
      cwd: path.resolve(import.meta.dir, "../../../.."),
      env: { ...Bun.env, OPENCORVUS_HOME: isolatedHome },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    if (exitCode !== 0) throw new Error(`On-demand payload production-route probe failed (${exitCode}): ${stderr}`)

    const outputLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1)
    const result = JSON.parse(outputLine ?? "null") as {
      payloadCount: number
      defaultIDs: string[]
      marketAvailable: number
      installedID: string
      installedDigest: string
      installedSkillRefs: string[]
      activeSquadID: string
      requestCount: number
    }

    expect(result).toEqual({
      payloadCount: 95,
      defaultIDs: ["advanced", "base", "research-studio", "squad-sdk"],
      marketAvailable: 95,
      installedID: "one-person-company-operating-system",
      installedDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      installedSkillRefs: ["one-person-company-operating-system/shared/method"],
      activeSquadID: "base",
      requestCount: 12,
    })
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 240_000)
