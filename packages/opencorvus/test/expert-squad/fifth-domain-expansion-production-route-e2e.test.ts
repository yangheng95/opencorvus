import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("serves the fifth ten Skill-and-asset domain Squads through isolated production HTTP routes", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-fifth-domain-http-"))
  const probe = path.join(import.meta.dir, "fifth-domain-expansion-production-route-probe.ts")
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
    if (exitCode !== 0) throw new Error("Fifth-domain production-route probe failed (" + exitCode + "): " + stderr)
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
    expect(result.projections.map(({ id, skillRef }) => ({ id, skillRef }))).toEqual([
      { id: "pharmacovigilance-drug-safety", skillRef: "pharmacovigilance-drug-safety/shared/method" },
      { id: "laboratory-quality-assurance", skillRef: "laboratory-quality-assurance/shared/method" },
      { id: "patent-landscape-prior-art", skillRef: "patent-landscape-prior-art/shared/method" },
      { id: "railway-operations-safety", skillRef: "railway-operations-safety/shared/method" },
      { id: "maritime-port-operations", skillRef: "maritime-port-operations/shared/method" },
      { id: "water-wastewater-operations", skillRef: "water-wastewater-operations/shared/method" },
      { id: "chemical-process-safety", skillRef: "chemical-process-safety/shared/method" },
      { id: "automotive-functional-safety", skillRef: "automotive-functional-safety/shared/method" },
      { id: "ai-model-governance-evaluation", skillRef: "ai-model-governance-evaluation/shared/method" },
      { id: "actuarial-reserving", skillRef: "actuarial-reserving/shared/method" },
    ])
    expect(
      result.projections.map(({ id, agentCount, rootCount, joinCount }) => ({ id, agentCount, rootCount, joinCount })),
    ).toEqual([
      { id: "pharmacovigilance-drug-safety", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "laboratory-quality-assurance", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "patent-landscape-prior-art", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "railway-operations-safety", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "maritime-port-operations", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "water-wastewater-operations", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "chemical-process-safety", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "automotive-functional-safety", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "ai-model-governance-evaluation", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "actuarial-reserving", agentCount: 5, rootCount: 4, joinCount: 1 },
    ])
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 180_000)
