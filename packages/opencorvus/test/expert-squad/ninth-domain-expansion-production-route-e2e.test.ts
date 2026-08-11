import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("serves and installs the ninth ten Skill-and-asset domain Squads through isolated production HTTP routes", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-ninth-domain-http-"))
  const probe = path.join(import.meta.dir, "ninth-domain-expansion-production-route-probe.ts")
  try {
    const child = Bun.spawn([process.execPath, probe, path.join(isolatedRoot, "project")], {
      cwd: path.resolve(import.meta.dir, "../../../.."),
      env: { ...Bun.env, OPENCORVUS_HOME: path.join(isolatedRoot, "home") },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    if (exitCode !== 0) throw new Error(`Ninth-domain production-route probe failed (${exitCode}): ${stderr}`)
    const outputLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1)
    const result = JSON.parse(outputLine ?? "null") as {
      packages: number
      requestCount: number
      activeSquadID: string
      projections: Array<{
        id: string
        packageDigest: string
        skillRef: string
        agentCount: number
        rootCount: number
        joinCount: number
      }>
    }
    const ids = [
      "clinical-genomics-variant-evidence-review",
      "transfusion-medicine-blood-component-assurance",
      "medical-device-human-factors-usability-assurance",
      "dam-safety-surveillance-assurance",
      "bridge-structural-integrity-assurance",
      "marine-vessel-survey-maintenance-assurance",
      "corporate-governance-entity-secretariat",
      "corporate-treasury-liquidity-operations",
      "student-financial-aid-administration",
      "digital-accessibility-assurance",
    ]
    expect(result.packages).toBe(10)
    expect(result.requestCount).toBe(41)
    expect(result.activeSquadID).toBe("base")
    expect(result.projections).toHaveLength(10)
    expect(result.projections.every((entry) => /^[a-f0-9]{64}$/.test(entry.packageDigest))).toBe(true)
    expect(result.projections.map(({ id, skillRef }) => ({ id, skillRef }))).toEqual(
      ids.map((id) => ({ id, skillRef: `${id}/shared/method` })),
    )
    expect(
      result.projections.map(({ id, agentCount, rootCount, joinCount }) => ({ id, agentCount, rootCount, joinCount })),
    ).toEqual(ids.map((id) => ({ id, agentCount: 5, rootCount: 4, joinCount: 1 })))
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 240_000)
