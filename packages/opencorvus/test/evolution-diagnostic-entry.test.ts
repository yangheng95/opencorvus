import { expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { Global } from "../src/global"
import { ModelsDev } from "../src/provider/models"
import { stageDiagnosticProvider } from "../script/evolution-diagnostic-provider"
import { CredentialRedactor } from "../script/real-provider-audit"

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

test("diagnostic preparation executes real isolated startup and settles its owned runtime", async () => {
  const parent = await Global.createTemporaryDirectory("evolution-diagnostic-entry-")
  const root = path.join(parent, "prepare")
  const script = path.resolve(import.meta.dir, "../script/evolution-diagnostic.ts")
  const invoke = async () => {
    const child = Bun.spawn([process.execPath, script, "--prepare", "--run-root", root], { stdout: "pipe", stderr: "pipe" })
    const [exit, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return { exit, stdout, stderr }
  }
  try {
    const first = await invoke()
    if (first.exit !== 0) throw new Error(`Preparation failed: ${first.stdout}\n${first.stderr}`)
    const receipt = JSON.parse(await readFile(path.join(root, "result.json"), "utf8"))
    expect(receipt).toMatchObject({ mode: "prepare", outcome: "prepared", model: "openai/gpt-5.6-luna",
      requestCeiling: null, inactivityMs: 300_000, pollIntervalMs: 2_000, businessVerdict: "not_evaluated",
      providerProjection: "not_checked",
      initialTree: "d285b2ec25c80d6389dee4cfb6092a45a4533157466dbf96caa3ec8f20ac036b",
      cleanup: { runtimeDisposed: true, credentialsRemoved: true },
      target: { id: "data-analysis", version: "2026.09.02.1", packageDigest: "27141f11209e4891fc2119b3f84a239238c08d8951cd5fefab6143e30f31e0ed" },
    })
    const initial = JSON.parse(await readFile(path.join(root, "initial-tree.json"), "utf8"))
    expect(initial.files.map((file: { path: string }) => file.path)).toEqual([".gitattributes", ".gitignore", "metrics.json", "request.md"])
    const usage = JSON.parse(await readFile(path.join(root, "usage.json"), "utf8"))
    expect({ authority: usage.authority, cost: usage.recordedCostUSD }).toEqual({ authority: "original provider_usage_event", cost: null })
    const second = await invoke()
    expect({ exit: second.exit, error: /DiagnosticRunAlreadyExists/.exec(second.stderr)?.[0] }).toEqual({ exit: 1, error: "DiagnosticRunAlreadyExists" })
    expect(JSON.parse(await readFile(path.join(root, "result.json"), "utf8"))).toEqual(receipt)
    console.log("G59_PREPARED " + JSON.stringify({ sourceCommit: receipt.sourceCommit, initialTree: receipt.initialTree, cleanup: receipt.cleanup }))
  } finally { await rm(parent, { recursive: true, force: true }) }
}, 90_000)
