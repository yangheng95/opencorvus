import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("serves the eighth ten Skill-and-asset domain Squads through isolated production HTTP routes", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-eighth-domain-http-"))
  const probe = path.join(import.meta.dir, "eighth-domain-expansion-production-route-probe.ts")
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
    if (exitCode !== 0) throw new Error("Eighth-domain production-route probe failed (" + exitCode + "): " + stderr)
    const outputLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1)
    const result = JSON.parse(outputLine ?? "null") as {
      packages: number
      requestCount: number
      projections: Array<{
        id: string
        packageDigest: string
        skillRef: string
        agentCount: number
        rootCount: number
        joinCount: number
      }>
    }
    expect(result.packages).toBe(10)
    expect(result.requestCount).toBe(40)
    expect(result.projections).toHaveLength(10)
    expect(result.projections.every((entry) => /^[a-f0-9]{64}$/.test(entry.packageDigest))).toBe(true)
    expect(result.projections.map(({ id, skillRef }) => ({ id, skillRef }))).toEqual(
      [
        "one-person-company-operating-system",
        "pipeline-integrity-management",
        "meteorological-observation-forecast-assurance",
        "hazardous-waste-compliance-operations",
        "identity-access-governance",
        "enterprise-backup-recovery-assurance",
        "securities-post-trade-operations",
        "air-traffic-management-safety",
        "cloud-finops-cost-governance",
        "service-reliability-incident-operations",
      ].map((id) => ({ id, skillRef: id + "/shared/method" })),
    )
    expect(
      result.projections.map(({ id, agentCount, rootCount, joinCount }) => ({ id, agentCount, rootCount, joinCount })),
    ).toEqual([
      { id: "one-person-company-operating-system", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "pipeline-integrity-management", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "meteorological-observation-forecast-assurance", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "hazardous-waste-compliance-operations", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "identity-access-governance", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "enterprise-backup-recovery-assurance", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "securities-post-trade-operations", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "air-traffic-management-safety", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "cloud-finops-cost-governance", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "service-reliability-incident-operations", agentCount: 5, rootCount: 4, joinCount: 1 },
    ])
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 180_000)
