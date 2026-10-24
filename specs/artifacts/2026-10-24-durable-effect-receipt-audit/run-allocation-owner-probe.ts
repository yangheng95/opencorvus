import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
const root = path.resolve(import.meta.dir, "../../..")
const evidence = path.join(
  root,
  ".tmp-product-iteration/durable-effect-receipt-audit/automation",
  process.argv[2] ?? `allocation-${Date.now()}`,
)
await fs.mkdir(evidence, { recursive: true })
const requests: any[] = []
const { controlledMemoryReply, controlledProviderRequestKind } = await import(
  pathToFileURL(path.join(root, "packages/opencorvus/test/fixture/controlled-streaming-provider.ts")).href
)
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  idleTimeout: 255,
  async fetch(request) {
    const body = (await request.json()) as any
    const kind = controlledProviderRequestKind(body.messages ?? [])
    requests.push({ kind, time: Date.now() })
    const content =
      kind === "memory" ? controlledMemoryReply(body.messages) : "Actual pre-reservation allocation restarted reply."
    const chunk = (delta: any, finish: any) =>
      `data: ${JSON.stringify({ id: `allocation-${requests.length}`, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: "local", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
    return new Response(
      chunk({ role: "assistant" }, null) + chunk({ content }, null) + chunk({}, "stop") + "data: [DONE]\n\n",
      { headers: { "content-type": "text/event-stream" } },
    )
  },
})
async function run(action: string) {
  const child = Bun.spawn(
    [process.execPath, path.join(import.meta.dir, "allocation-owner-probe.ts"), action, evidence, String(server.port)],
    { cwd: root, env: process.env, stdout: "pipe", stderr: "pipe" },
  )
  const [exit, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  await fs.writeFile(
    path.join(evidence, `${action}-process.json`),
    JSON.stringify({ action, exit, stdout, stderr }, null, 2),
  )
  console.log(JSON.stringify({ action, exit }))
  return { exit, stdout, stderr }
}
try {
  assert.equal((await run("prepare-global-allocation-alive")).exit, 23)
  const results = await Promise.allSettled([run("resume-allocation-A"), run("resume-allocation-B")])
  await fs.writeFile(path.join(evidence, "results.json"), JSON.stringify({ results, requests }, null, 2))
  assert(
    results.every((r) => r.status === "fulfilled" && r.value.exit === 0),
    JSON.stringify(results),
  )
  assert.equal(requests.filter((r) => r.kind !== "memory").length, 1)
} finally {
  await server.stop(true)
}
