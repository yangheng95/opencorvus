import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { Database } from "bun:sqlite"
import { bootstrapIsolatedTestRuntime } from "@opencorvus-ai/util/test-runtime-environment"

// Owns only isolated child processes. Uses the production CLI, server, database,
// SDK and streaming provider adapter; does not use real accounts or credentials.
const runtime = await bootstrapIsolatedTestRuntime("runner")
const root = runtime.processRoot
const project = path.join(root, "project")
await fs.mkdir(project)
await fs.mkdir(path.join(root, "home"), { recursive: true })
const models = path.join(root, "models.json")
await fs.copyFile(path.resolve(import.meta.dir, "../src/provider/models-bootstrap.json"), models)
const requests: Array<{ model: string; stream: boolean }> = []
let status = 200
const provider = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const body = (await request.json()) as {
      model: string
      stream: boolean
      messages?: Array<{ role: string; content: string }>
    }
    requests.push({ model: body.model, stream: body.stream })
    if (status !== 200) return Response.json({ error: { message: `checker HTTP ${status}` } }, { status })
    const memory = body.messages?.some(
      (message) =>
        message.role === "system" &&
        typeof message.content === "string" &&
        message.content.includes("dedicated Memory Organizer"),
    )
    const instruction = body.messages?.find((message) => message.role === "user")?.content
    const coveredOccurrenceIDs =
      typeof instruction === "string"
        ? JSON.parse(instruction.match(/coveredOccurrenceIDs must be exactly (\[[^\n]+\])/u)?.[1] ?? "[]")
        : []
    const content = memory
      ? JSON.stringify({ baseRevision: 0, coveredOccurrenceIDs, disposition: "organized", markdown: "" })
      : "CLI_RUN_OK"
    const chunks = [
      { choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] },
      {
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      },
    ]
    return new Response(
      new ReadableStream({
        async start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(
              new TextEncoder().encode(
                `data: ${JSON.stringify({ id: "check", object: "chat.completion.chunk", created: 1, model: "check-model", ...chunk })}\n\n`,
              ),
            )
            await Bun.sleep(30)
          }
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"))
          controller.close()
        },
      }),
      { headers: { "content-type": "text/event-stream" } },
    )
  },
})
const config = {
  model: "check/check-model",
  small_model: "check/check-model",
  enabled_providers: ["check"],
  provider: {
    check: {
      name: "CLI checker",
      npm: "@ai-sdk/openai-compatible",
      options: { baseURL: `${provider.url.origin}/v1`, apiKey: "local-checker" },
      models: { "check-model": { name: "Checker", limit: { context: 32768, output: 1024 } } },
    },
  },
}
const env = {
  ...process.env,
  OPENCORVUS_TEST_HOME: path.join(root, "home"),
  OPENCORVUS_CONFIG_CONTENT: JSON.stringify(config),
  OPENCORVUS_MODELS_PATH: models,
  OPENCORVUS_DISABLE_EXTERNAL_SKILLS: "1",
  OPENCORVUS_DISABLE_PROJECT_CONFIG: "1",
  OPENCORVUS_DISABLE_AUTOUPDATE: "1",
  OPENCORVUS_RUN_STALL_TIMEOUT_MS: "15000",
}
const entry = path.resolve(import.meta.dir, "../src/index.ts")
const results: unknown[] = []
const password = "isolated-cli-checker"
const authorization = `Basic ${btoa(`opencorvus:${password}`)}`
async function startServer() {
  const receipt = path.join(root, `server-${Date.now()}.json`)
  const child = Bun.spawn(
    [
      process.execPath,
      entry,
      "serve",
      "--port",
      "0",
      "--hostname",
      "127.0.0.1",
      "--startup-receipt",
      receipt,
      "--startup-occurrence",
      "cli-checker",
    ],
    {
      cwd: path.resolve(import.meta.dir, ".."),
      env: { ...env, OPENCORVUS_SERVER_PASSWORD: password },
      stdin: "ignore",
      stdout: Bun.file(`${receipt}.stdout`),
      stderr: Bun.file(`${receipt}.stderr`),
    },
  )
  const deadline = Date.now() + 45000
  while (Date.now() < deadline && child.exitCode === null) {
    const fact = await Bun.file(receipt)
      .json()
      .catch(() => undefined)
    if (fact) {
      assert.equal(fact.outcome, "listening", JSON.stringify(fact))
      return { child, url: fact.url as string }
    }
    await Bun.sleep(100)
  }
  child.kill()
  await child.exited
  throw new Error(`Checker server failed to start: ${receipt}`)
}
async function stopServer(server: Awaited<ReturnType<typeof startServer>>) {
  const response = await fetch(`${server.url}/shutdown`, { method: "POST", headers: { authorization } })
  assert.equal(response.status, 200)
  const timer = setTimeout(() => server.child.kill(), 20000)
  try {
    assert.equal(await server.child.exited, 0)
  } finally {
    clearTimeout(timer)
  }
}
async function run(label: string, args: string[], expected: number, extraEnv = {}) {
  const start = Date.now()
  const child = Bun.spawn(
    [
      process.execPath,
      entry,
      "run",
      "--format",
      "json",
      ...(args.includes("--dir") ? [] : ["--dir", project]),
      ...args,
    ],
    {
      cwd: path.resolve(import.meta.dir, ".."),
      env: { ...env, ...extraEnv },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  let killed = false
  const timer = setTimeout(() => {
    killed = true
    child.kill()
  }, 45000)
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  clearTimeout(timer)
  const events = stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const result = { label, code, killed, ms: Date.now() - start, events, stderr }
  results.push(result)
  await fs.writeFile(path.join(root, "results.json"), JSON.stringify(results, null, 2))
  console.log(
    JSON.stringify({
      label,
      code,
      killed,
      ms: result.ms,
      types: events.map((event) => event.type),
      errors: events.filter((event) => event.type === "error"),
    }),
  )
  assert.equal(killed, false, `${label}: process exceeded 45s; evidence ${root}`)
  assert.equal(code, expected, `${label}: ${stderr}; evidence ${root}`)
  if (expected === 0) {
    assert.equal(events.find((event) => event.type === "text")?.part.text, "CLI_RUN_OK")
    assert.equal(events.at(-1)?.type, "step_finish")
    assert.equal(new Set(events.map((event) => event.sessionID)).size, 1)
  } else {
    assert.equal(events.filter((event) => event.type === "error").length, 1)
    assert.equal(typeof events.find((event) => event.type === "error")?.error.name, "string")
  }
  return events
}
try {
  console.log(`Evidence: ${root}`)
  const first = await run("local-chat", ["--agent", "chat", "Say CLI_RUN_OK"], 0)
  await run("local-continue", ["--agent", "chat", "--session", first[0].sessionID, "Say CLI_RUN_OK again"], 0)
  await run("input-error", ["--fork", "hello"], 1)
  await run("missing-model", ["--model", "missing/model", "hello"], 1)
  await run("bad-config", ["hello"], 1, { OPENCORVUS_CONFIG_CONTENT: "{" })
  await run("bad-option", ["--unknown-checker-option", "hello"], 1)
  await run("missing-file", ["--file", path.join(root, "missing.txt"), "hello"], 1)
  await run("missing-directory", ["--dir", path.join(root, "missing-dir"), "hello"], 1)
  for (const code of [401, 400]) {
    status = code
    await run(`provider-${code}`, ["--agent", "chat", "hello"], 1)
  }
  status = 200
  let server = await startServer()
  const attachedEnv = { OPENCORVUS_SERVER_PASSWORD: password }
  try {
    const attached = await run("attached-chat", ["--attach", server.url, "--agent", "chat", "hello"], 0, attachedEnv)
    const sessionID = attached[0].sessionID
    await run(
      "attached-continue",
      ["--attach", server.url, "--session", sessionID, "--agent", "chat", "again"],
      0,
      attachedEnv,
    )
    status = 401
    await run("attached-provider-401", ["--attach", server.url, "--agent", "chat", "hello"], 1, attachedEnv)
    status = 200
    await run("attached-auth-401", ["--attach", server.url, "hello"], 1, {
      OPENCORVUS_SERVER_PASSWORD: "wrong-checker-password",
    })
    await run("attached-model-error", ["--attach", server.url, "--model", "missing/model", "hello"], 1, attachedEnv)
    const otherProject = path.join(root, "other-project")
    await fs.mkdir(otherProject)
    const parallel = await Promise.allSettled([
      run("parallel-project-a", ["--attach", server.url, "--agent", "chat", "hello"], 0, attachedEnv),
      run(
        "parallel-project-b",
        ["--attach", server.url, "--dir", otherProject, "--agent", "chat", "hello"],
        0,
        attachedEnv,
      ),
    ])
    for (const result of parallel) if (result.status === "rejected") throw result.reason
    await stopServer(server)
    server = await startServer()
    await run(
      "attached-after-server-restart",
      ["--attach", server.url, "--session", sessionID, "--agent", "chat", "again after restart"],
      0,
      attachedEnv,
    )
  } finally {
    if (server.child.exitCode === null) await stopServer(server)
  }
  const db = new Database(path.join(runtime.runtimeRoot, "data/opencorvus.db"), { readonly: true })
  try {
    const facts = db
      .query(
        "SELECT type, aggregate_type, aggregate_id, session_id, payload FROM protocol_event WHERE type IN ('agent.execution.lifecycle', 'session.error')",
      )
      .all()
    await fs.writeFile(path.join(root, "lifecycle-facts.json"), JSON.stringify(facts, null, 2))
    assert.ok(facts.length > 0)
    const replies = db
      .query(
        "SELECT COUNT(*) AS count FROM message WHERE json_extract(data, '$.role')='assistant' AND json_extract(data, '$.time.completed') IS NOT NULL",
      )
      .get() as { count: number }
    assert.ok(replies.count >= 10)
  } finally {
    db.close()
  }
  assert.equal(
    requests.every((request) => request.stream && request.model === "check-model"),
    true,
  )
  console.log(`PASS: ${results.length} real CLI cases. Evidence retained at ${root}`)
} finally {
  await provider.stop(true)
}
