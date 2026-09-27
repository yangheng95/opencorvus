import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { Database } from "bun:sqlite"
import { latestAuditSnapshotFiles } from "./audit-snapshot"

export class DiagnosticInitializationError extends Error {
  override readonly name = "DiagnosticInitializationError"
  constructor(readonly reason: string, detail: string) { super(`${reason}: ${detail}`) }
}

const fail = (reason: string, detail: string): never => { throw new DiagnosticInitializationError(reason, detail) }
async function absent(file: string, reason: string) {
  try { await fs.lstat(file) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return
    throw error
  }
  fail(reason, file)
}

/** Resumes only local initialization; the root's unique business launch remains authoritative. */
export async function claimDiagnosticInitialization(input: { root: string; parent: string; mode: "run" | "prepare"; model: string; registration: unknown }) {
  if (input.parent !== "." && !/^initializations\/[a-f0-9-]{36}$/.test(input.parent))
    fail("invalid_parent", "Choose the original receipt directory or an exact initialization receipt")
  const root = await fs.realpath(input.root)
  const parent = path.join(root, input.parent)
  const actual = await fs.realpath(parent)
  if (path.relative(root, actual) !== path.relative(root, parent)) fail("invalid_parent", "Receipt directory changed identity")
  for (const name of ["launch.json", "preflight.json", "mission.json", "stop"])
    await absent(path.join(root, name), "business_boundary_reached")
  await absent(path.join(parent, "continuation.json"), "already_continued")
  const read = async (name: string) => JSON.parse(await fs.readFile(path.join(parent, name), "utf8"))
  const claim = await read("claim.json")
  const result = await read("result.json")
  for (const name of ["schema", "mode", "model", "pid", "startedAt", "sourceCommit"])
    if (claim[name] === undefined || claim[name] !== result[name]) fail("receipt_identity_mismatch", name)
  if (claim.registration === undefined || !isDeepStrictEqual(claim.registration, result.registration))
    fail("receipt_identity_mismatch", "registration")
  if (!isDeepStrictEqual(claim.registration, input.registration)) fail("registration_mismatch", "Original registration differs")
  if (claim.mode !== input.mode || claim.model !== input.model) fail("registration_mismatch", "Mode/model differs from the original claim")
  const eligible = result.outcome === "failed" || (input.mode === "prepare" && result.outcome === "prepared")
  if (!eligible || !Number.isFinite(Date.parse(result.finishedAt)) ||
      result.cleanup?.runtimeDisposed !== true || result.cleanup?.credentialsRemoved !== true)
    fail("initialization_unsettled", "Original initialization must have a completed cleanup receipt")
  for (const name of input.mode === "run" ? ["auth.json", "models.json"] : ["auth.json"])
    await absent(path.join(root, "home/data", name), "paired_copy_retained")
  const initialTree = await read("initial-tree.json")
  assert.equal(initialTree.protocol, "opencorvus/workspace-tree@1")
  const sqlite = new Database(path.join(root, "home/data/opencorvus.db"), { readonly: true })
  let counts: Record<string, number>
  try {
    counts = sqlite.transaction(() => Object.fromEntries(
      ["session", "engine_task", "provider_usage_event", "provider_activity_request"].map((table) => {
        const row = sqlite.query(`SELECT count(*) AS count FROM ${table}`).get() as { count: number }
        return [table, row.count]
      }),
    ))()
  } finally { sqlite.close() }
  if (Object.values(counts).some((count) => count !== 0)) fail("business_facts_recorded", JSON.stringify(counts))
  const auditFiles = await latestAuditSnapshotFiles(path.join(root, "provider-audit"), "provider")
  if (input.mode === "run" && auditFiles.length === 0) fail("provider_observation_unavailable", "Original audit is required")
  for (const file of auditFiles) {
    const audit = JSON.parse(await fs.readFile(file, "utf8"))
    if (!Array.isArray(audit.requests) || audit.requests.length !== 0) fail("provider_request_recorded", file)
  }
  // A parent has one successor. An unfinished successor is evidence to inspect, never a stale lock to discard.
  const receiptDirectory = `initializations/${randomUUID()}`
  const continuation = { parent: input.parent, receiptDirectory, pid: process.pid, claimedAt: new Date().toISOString(), counts }
  try { await fs.writeFile(path.join(parent, "continuation.json"), JSON.stringify(continuation, null, 2) + "\n", { flag: "wx" }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") fail("already_continued", parent)
    throw error
  }
  const directory = path.join(root, receiptDirectory)
  await fs.mkdir(directory, { recursive: true })
  return { directory, receiptDirectory, parent: input.parent, initialTree, previous: result, counts }
}
