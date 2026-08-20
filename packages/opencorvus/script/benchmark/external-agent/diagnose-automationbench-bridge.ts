import crypto from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import net from "node:net"

const python = process.argv[2] ?? process.env.AUTOMATION_BENCH_PYTHON
if (!python) throw new Error("Pass the AutomationBench Python executable or set AUTOMATION_BENCH_PYTHON")
const adminToken = crypto.randomBytes(24).toString("hex")
const events = path.join(os.tmpdir(), `opencorvus-automationbench-diagnostic-${crypto.randomUUID()}.jsonl`)
const initialWorld = path.join(os.tmpdir(), `opencorvus-automationbench-initial-world-${crypto.randomUUID()}.json`)
const finalWorld = path.join(os.tmpdir(), `opencorvus-automationbench-final-world-${crypto.randomUUID()}.json`)
const toolSocket = path.join(os.tmpdir(), `opencorvus-automationbench-tool-${crypto.randomUUID()}.sock`)
const agentUID = typeof process.getuid === "function" && process.getuid() === 0 ? 60_001 : process.getuid?.() ?? 0

function unixRequest(route: string, payload: unknown) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const body = JSON.stringify(payload)
    const socket = net.createConnection(toolSocket)
    const chunks: Buffer[] = []
    socket.on("connect", () => {
      socket.write(
        `POST ${route} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`,
      )
    })
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
    socket.on("error", reject)
    socket.on("end", () => {
      const response = Buffer.concat(chunks).toString("utf8")
      const boundary = response.indexOf("\r\n\r\n")
      const status = Number(response.slice(0, response.indexOf("\r\n")).split(" ")[1])
      resolve({ status, body: JSON.parse(response.slice(boundary + 4)) })
    })
  })
}
const child = Bun.spawn(
  [
    path.resolve(python),
    path.join(import.meta.dir, "automationbench_bridge.py"),
    "--domain",
    "sales",
    "--task",
    "sales.multi_hop_lookup",
    "--events",
    events,
    "--initial-world",
    initialWorld,
    "--final-world",
    finalWorld,
    "--tool-socket",
    toolSocket,
    "--agent-uid",
    String(agentUID),
  ],
  { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
)
child.stdin.write(`${adminToken}\n`)
child.stdin.end()

try {
  const reader = child.stdout.getReader()
  const decoder = new TextDecoder()
  let pending = ""
  let ready: { port: number } | undefined
  while (!ready) {
    const next = await reader.read()
    if (next.done) throw new Error(`Bridge exited before ready: ${await new Response(child.stderr).text()}`)
    pending += decoder.decode(next.value, { stream: true })
    const newline = pending.indexOf("\n")
    if (newline >= 0) ready = JSON.parse(pending.slice(0, newline))
  }
  const baseURL = `http://127.0.0.1:${ready.port}`
  const commandLine =
    process.platform === "win32"
      ? Bun.spawnSync([
          "powershell",
          "-NoProfile",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter \"ProcessId = ${child.pid}\").CommandLine`,
        ]).stdout.toString()
      : await Bun.file(`/proc/${child.pid}/cmdline`).text()
  if (commandLine.includes(adminToken)) throw new Error("Bridge admin token leaked into the child process command line")
  const health = await fetch(`${baseURL}/health`).then((response) => response.json())
  const adminSurfaceTool = await fetch(`${baseURL}/v1/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "must not route", top_k: 1 }),
  })
  const toolSurfaceAdmin = await unixRequest("/admin/score", {})
  const search = await unixRequest("/v1/search", { query: "Meridian Corp opportunity", top_k: 5 })
  const concurrentSearches = await Promise.all(
    Array.from({ length: 40 }, (_, index) =>
      unixRequest("/v1/search", { query: `Meridian Corp opportunity ${index}`, top_k: 1 }),
    ),
  )
  const task = await fetch(`${baseURL}/admin/task`, {
    headers: { authorization: `Bearer ${adminToken}` },
  }).then(async (response) => ({ status: response.status, body: await response.json() }))
  const failedSearch = await unixRequest("/v1/search", { query: "", top_k: 1 })
  const racingFetchPromise = unixRequest("/v1/fetch", {
      method: "GET",
      url: "https://yourinstance.salesforce.com/services/data/v61.0/search",
      params: JSON.stringify({ q: "FIND {Meridian Corp} IN ALL FIELDS RETURNING Opportunity,Account" }),
      body: null,
    })
  const scorePromise = fetch(`${baseURL}/admin/score`, {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: "{}",
  }).then(async (response) => ({ status: response.status, body: await response.json() }))
  const [racingFetch, score] = await Promise.all([racingFetchPromise, scorePromise])
  const postScoreSearch = await unixRequest("/v1/search", { query: "post score rejection", top_k: 1 })
  const expectedSucceeded = racingFetch.status === 200 ? 42 : 41
  const expectedFailed = 1
  const expectedAttempts = expectedSucceeded + expectedFailed
  const eventLedger = (await Bun.file(events).text())
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const scoreEventIndex = eventLedger.findIndex((event) => event.kind === "score")
  const acceptedToolEvents = eventLedger.filter((event, index) => index < scoreEventIndex && ["tool", "tool_error"].includes(event.kind))
  const replay = Bun.spawn(
    [
      path.resolve(python),
      path.join(import.meta.dir, "verify_automationbench_replay.py"),
      "--domain",
      "sales",
      "--task",
      "sales.multi_hop_lookup",
      "--events",
      events,
      "--initial-world",
      initialWorld,
      "--final-world",
      finalWorld,
    ],
    { cwd: import.meta.dir, stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  )
  replay.stdin.write(JSON.stringify({ ...(score.body as object), initial_world_sha256: (task.body as any).initial_world_sha256 }))
  replay.stdin.end()
  const [replayExit, replayStdout, replayStderr] = await Promise.all([
    replay.exited,
    new Response(replay.stdout).text(),
    new Response(replay.stderr).text(),
  ])
  const replayAudit = replayExit === 0 ? JSON.parse(replayStdout) : undefined
  if (
    !(health as any).ok ||
    adminSurfaceTool.status !== 404 ||
    toolSurfaceAdmin.status !== 404 ||
    search.status !== 200 ||
    !Array.isArray((search.body as any).results) ||
    task.status !== 200 ||
    concurrentSearches.some((response) => response.status !== 200) ||
    failedSearch.status !== 400 ||
    ![200, 409].includes(racingFetch.status) ||
    score.status !== 200 ||
    postScoreSearch.status !== 409 ||
    (postScoreSearch.body as any).error !== "benchmark_world_sealed" ||
    (score.body as any).tool_calls !== expectedAttempts ||
    (score.body as any).tool_attempts !== expectedAttempts ||
    (score.body as any).tool_succeeded !== expectedSucceeded ||
    (score.body as any).tool_failed !== expectedFailed ||
    (score.body as any).max_in_flight_stateless < 2 ||
    acceptedToolEvents.length !== expectedAttempts ||
    scoreEventIndex < 0 ||
    replayExit !== 0 ||
    replayAudit?.passed !== true ||
    (task.body as any).distribution_version !== "1.0.6" ||
    (task.body as any).package_tree_sha256 !== "cc7a63f9444814c7029e325dacbdf1c2e870430d08aaf8d4ecf5c0e44fe829d4" ||
    (task.body as any).task_contract_sha256 !== "26ce00f60615d97e822bf7aed4d5d248477e0e6b0938c1ce3f6eda45067432eb"
  ) {
    throw new Error(
      `Bridge diagnostic failed: ${JSON.stringify({ health_ok: (health as any).ok, search_status: search.status, task_status: task.status, replay: replayStderr.trim() })}`,
    )
  }
  process.stdout.write(
    JSON.stringify({
      ok: true,
      tool_route_auth: "uid-scoped-unix-socket",
      admin_route_auth: "host-only-stdin",
      surfaces_separated: true,
      admin_secret_in_argv: false,
      distribution_version: (task.body as any).distribution_version,
      package_tree_sha256: (task.body as any).package_tree_sha256,
      task_contract_sha256: (task.body as any).task_contract_sha256,
      search_results: (search.body as any).results.length,
      concurrent_tool_attempts: (score.body as any).tool_attempts,
      concurrent_tool_succeeded: (score.body as any).tool_succeeded,
      concurrent_tool_failed: (score.body as any).tool_failed,
      max_in_flight_stateless: (score.body as any).max_in_flight_stateless,
      score_race_fetch_status: racingFetch.status,
      post_score_tool_status: postScoreSearch.status,
      scorer_replay: true,
    }) +
      "\n",
  )
} finally {
  child.kill()
  await child.exited
  await Promise.all([
    fs.rm(events, { force: true }),
    fs.rm(initialWorld, { force: true }),
    fs.rm(finalWorld, { force: true }),
    fs.rm(toolSocket, { force: true }),
  ])
}
