import { expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Global } from "../src/global"
import { ModelsDev } from "../src/provider/models"
import { stageDiagnosticProvider } from "../script/evolution-diagnostic-provider"
import { CredentialRedactor } from "../script/real-provider-audit"
import { claimDiagnosticInitialization, DiagnosticInitializationError } from "../script/evolution-diagnostic-initialization"
import { Database } from "bun:sqlite"

test("diagnostic paired staging preserves the complete runtime catalog and scoped authority", async () => {
  const root = await Global.createTemporaryDirectory("evolution-diagnostic-provider-")
  const source = path.join(root, "source")
  const destination = path.join(root, "destination")
  try {
    await mkdir(source)
    await mkdir(destination)
    const catalog = await ModelsDev.get()
    const modelID = Object.keys(catalog.openai.models).sort()[0]!
    const bytes = JSON.stringify(catalog, null, 2) + "\n"
    const expires = Date.now() + 3_600_000
    const authority = { openai: { info: { type: "oauth", access: "local-test-access", refresh: "local-test-refresh", expires } },
      unrelated: { info: { type: "api", key: "local-test-unrelated-key" } } }
    await writeFile(path.join(source, "auth.json"), JSON.stringify(authority))
    await writeFile(path.join(source, "models.json"), bytes)
    const access = await stageDiagnosticProvider({ authSource: path.join(source, "auth.json"), dataDirectory: destination,
      modelID, redactor: new CredentialRedactor() })
    expect(access).toEqual({ providerID: "openai", modelID, copiedOAuthExpiresAt: expires })
    expect(JSON.parse(await readFile(path.join(destination, "auth.json"), "utf8"))).toEqual({ openai: authority.openai })
    const staged = await readFile(path.join(destination, "models.json"), "utf8")
    expect(staged).toEqual(bytes)
    const validated = ModelsDev.validateExplicitCatalog(JSON.parse(staged))
    expect(validated.openai.models[modelID]).toEqual(catalog.openai.models[modelID])
    expect(validated.kilo).toEqual(catalog.kilo)
    expect(validated.opencorvus).toEqual(catalog.opencorvus)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test("diagnostic preparation preserves its frozen registration across a newer installed package", async () => {
  const parent = await Global.createTemporaryDirectory("evolution-diagnostic-entry-")
  const root = path.join(parent, "prepare")
  const script = path.resolve(import.meta.dir, "../script/evolution-diagnostic.ts")
  const invoke = async (extra: string[] = []) => {
    const child = Bun.spawn([process.execPath, script, "--prepare", "--run-root", root, ...extra], { stdout: "pipe", stderr: "pipe" })
    const [exit, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return { exit, stdout, stderr }
  }
  try {
    const first = await invoke()
    expect(first.exit).toBe(1)
    const receipt = JSON.parse(await readFile(path.join(root, "result.json"), "utf8"))
    expect(receipt).toMatchObject({ mode: "prepare", outcome: "failed", model: "openai/gpt-5.6-luna",
      requestCeiling: null, inactivityMs: 300_000, pollIntervalMs: 2_000, businessVerdict: "not_evaluated",
      error: expect.stringContaining("Installed target differs from the registered G58 package"),
      initialTree: "d285b2ec25c80d6389dee4cfb6092a45a4533157466dbf96caa3ec8f20ac036b",
      cleanup: { runtimeDisposed: true, credentialsRemoved: true },
      target: { id: "data-analysis", version: "2026.09.27.1", packageDigest: "c96c5e687dc0fdf2ea4b81a4e3be427d6cfda85889ff09fe2091b229fc5a2fe0" },
    })
    const initial = JSON.parse(await readFile(path.join(root, "initial-tree.json"), "utf8"))
    expect(initial.files.map((file: { path: string }) => file.path)).toEqual([".gitattributes", ".gitignore", "metrics.json", "request.md"])
    const usage = JSON.parse(await readFile(path.join(root, "usage.json"), "utf8"))
    expect({ authority: usage.authority, cost: usage.recordedCostUSD }).toEqual({ authority: "original provider_usage_event", cost: null })
    const second = await invoke()
    expect({ exit: second.exit, error: /DiagnosticRunAlreadyExists/.exec(second.stderr)?.[0] }).toEqual({ exit: 1, error: "DiagnosticRunAlreadyExists" })
    expect(JSON.parse(await readFile(path.join(root, "result.json"), "utf8"))).toEqual(receipt)
    const originalResult = await readFile(path.join(root, "result.json"), "utf8")
    const originalClaim = await readFile(path.join(root, "claim.json"), "utf8")
    const resumed = await invoke(["--resume-initialization", "."])
    expect(resumed.exit).toBe(1)
    const continuation = JSON.parse(await readFile(path.join(root, "continuation.json"), "utf8"))
    const childResult = JSON.parse(await readFile(path.join(root, continuation.receiptDirectory, "result.json"), "utf8"))
    expect(childResult).toMatchObject({ outcome: "failed", error: receipt.error, parentReceiptDirectory: ".", initialTree: receipt.initialTree,
      target: { packageDigest: receipt.target.packageDigest }, cleanup: receipt.cleanup })
    expect(continuation.counts).toEqual({ session: 0, engine_task: 0, provider_usage_event: 0, provider_activity_request: 0 })
    expect(await readFile(path.join(root, "result.json"), "utf8")).toEqual(originalResult)
    expect(await readFile(path.join(root, "claim.json"), "utf8")).toEqual(originalClaim)
    const retry = await invoke(["--resume-initialization", "."])
    expect({ exit: retry.exit, reason: /already_continued/.exec(retry.stderr)?.[0] }).toEqual({ exit: 1, reason: "already_continued" })
    const request = { root, parent: continuation.receiptDirectory, mode: "prepare" as const, model: receipt.model }
    const reason = async (run: () => Promise<unknown>) => {
      try { await run(); return "accepted" } catch (error) {
        if (!(error instanceof DiagnosticInitializationError)) throw error
        return error.reason
      }
    }
    expect(await reason(() => claimDiagnosticInitialization({ ...request, parent: "../outside" }))).toEqual("invalid_parent")
    await writeFile(path.join(root, "launch.json"), JSON.stringify({ phase: "local-test-started-boundary" }), { flag: "wx" })
    expect(await reason(() => claimDiagnosticInitialization(request))).toEqual("business_boundary_reached")
    await rm(path.join(root, "launch.json"))
    // Explicit local usage fixture in the actual prepared schema exercises the original-table check.
    const db = new Database(path.join(root, "home/data/opencorvus.db"))
    try {
      db.query(`INSERT INTO provider_usage_event
        (id, occurred_at, provider_id, model_id, purpose, input_tokens, output_tokens, reasoning_tokens,
         cache_read_tokens, cache_write_tokens, total_tokens, cost_usd, billing_status)
        VALUES ('local-test-usage', ?, 'openai', 'local-test-model', 'other', 1, 1, 0, 0, 0, 2, 0, 'unknown')`).run(Date.now())
    } finally { db.close() }
    expect(await reason(() => claimDiagnosticInitialization(request))).toEqual("business_facts_recorded")
    const fixtureDB = new Database(path.join(root, "home/data/opencorvus.db"))
    try { fixtureDB.query("DELETE FROM provider_usage_event WHERE id = 'local-test-usage'").run() }
    finally { fixtureDB.close() }
    const contenders = await Promise.allSettled([claimDiagnosticInitialization(request), claimDiagnosticInitialization(request)])
    expect(contenders.map((entry) => entry.status === "fulfilled" ? "claimed" : entry.reason.reason).sort())
      .toEqual(["already_continued", "claimed"])
    const successor = JSON.parse(await readFile(path.join(root, continuation.receiptDirectory, "continuation.json"), "utf8"))
    const accepted = contenders.find((entry) => entry.status === "fulfilled")!
    if (accepted.status !== "fulfilled") throw new Error("Expected one initialization claimant")
    expect(successor.receiptDirectory).toEqual(accepted.value.receiptDirectory)
    console.log("G59_PREPARED " + JSON.stringify({ sourceCommit: receipt.sourceCommit, initialTree: receipt.initialTree, cleanup: receipt.cleanup }))
  } finally { await rm(parent, { recursive: true, force: true }) }
}, 90_000)
