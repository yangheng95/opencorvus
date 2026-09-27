import { expect, test } from "bun:test"
import { readFile, rm } from "node:fs/promises"
import path from "node:path"
import { Global } from "../src/global"

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
