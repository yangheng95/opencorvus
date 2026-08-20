import crypto from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const python = process.argv[2]
const restrictedShell = process.argv[3]
const sourceData = process.argv[4]
if (!python || !restrictedShell || !sourceData) {
  throw new Error("Pass evaluator Python, installed restricted shell, and root-owned Provider data")
}
if (process.platform !== "linux" || process.getuid?.() !== 0) throw new Error("Isolation diagnostic requires WSL2 root")

const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-five-trial-isolation-"))
await fs.chmod(root, 0o711)
const trials: Array<{
  uid: number
  directory: string
  project: string
  home: string
  socketDirectory: string
  socketPath: string
  adminToken: string
  bridge: ReturnType<typeof Bun.spawn>
  adminURL: string
}> = []

async function chownTree(target: string, uid: number) {
  const stat = await fs.lstat(target)
  await fs.chown(target, uid, uid)
  if (stat.isDirectory()) {
    await fs.chmod(target, 0o700)
    for (const entry of await fs.readdir(target)) await chownTree(path.join(target, entry), uid)
  } else {
    await fs.chmod(target, 0o600)
  }
}

type PipedChild = Bun.Subprocess<"pipe", "pipe", "pipe">

async function ready(child: PipedChild) {
  const reader = child.stdout.getReader()
  const decoder = new TextDecoder()
  let pending = ""
  while (true) {
    const next = await reader.read()
    if (next.done) throw new Error(`Bridge failed before ready: ${await new Response(child.stderr).text()}`)
    pending += decoder.decode(next.value, { stream: true })
    const newline = pending.indexOf("\n")
    if (newline >= 0) return JSON.parse(pending.slice(0, newline)) as { port: number }
  }
}

try {
  for (let index = 0; index < 5; index++) {
    const uid = 60_001 + index
    const directory = path.join(root, `trial-${index + 1}`)
    const project = path.join(directory, "project")
    const socketDirectory = path.join(directory, "socket")
    const socketPath = path.join(socketDirectory, "tool.sock")
    const home = `/tmp/opencorvus-benchmark-agent-diag-${crypto.randomUUID()}-${index + 1}`
    await fs.mkdir(project, { recursive: true })
    await fs.mkdir(socketDirectory)
    await fs.mkdir(home, { mode: 0o700 })
    await fs.copyFile(path.join(import.meta.dir, "automationbench_tool.py"), path.join(project, "automationbench_tool.py"))
    await fs.writeFile(path.join(project, ".automationbench-tool.json"), JSON.stringify({ socket_path: socketPath }) + "\n")
    await fs.writeFile(path.join(project, "trial-marker"), `trial-${index + 1}\n`)
    await chownTree(project, uid)
    await fs.chown(socketDirectory, uid, uid)
    await fs.chmod(socketDirectory, 0o700)
    const adminToken = crypto.randomBytes(24).toString("hex")
    const bridge = Bun.spawn(
      [
        path.resolve(python),
        path.join(import.meta.dir, "automationbench_bridge.py"),
        "--domain",
        "sales",
        "--task",
        "sales.multi_hop_lookup",
        "--events",
        path.join(directory, "events.jsonl"),
        "--initial-world",
        path.join(directory, "initial-world.json"),
        "--final-world",
        path.join(directory, "final-world.json"),
        "--tool-socket",
        socketPath,
        "--agent-uid",
        String(uid),
      ],
      { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
    )
    bridge.stdin.write(`${adminToken}\n`)
    bridge.stdin.end()
    const bridgeReady = await ready(bridge)
    trials.push({ uid, directory, project, home, socketDirectory, socketPath, adminToken, bridge, adminURL: `http://127.0.0.1:${bridgeReady.port}` })
  }

  const probes = await Promise.all(
    trials.map(async (trial, index) => {
      const sibling = trials[(index + 1) % trials.length]!
      const quote = (value: string) => `'${value.replaceAll("'", `'"'"'`)}'`
      const command = [
        `set -euo pipefail`,
        `cd ${quote(trial.project)}`,
        `python3 automationbench_tool.py search "isolation diagnostic ${index + 1}" --top-k 1 >/dev/null`,
        `ln -s ${quote(path.join(sourceData, "auth.json"))} auth-link`,
        `test ! -r auth-link`,
        `test ! -r ${quote(path.join(sibling.project, "trial-marker"))}`,
        `test ! -r ${quote(sibling.socketPath)} && test ! -w ${quote(sibling.socketPath)}`,
        `test ! -x ${quote(sibling.home)}`,
        `test ! -r /proc/${sibling.bridge.pid}/environ && test ! -r /proc/${sibling.bridge.pid}/mem && test ! -r /proc/${sibling.bridge.pid}/fd/0 && test ! -r /proc/${sibling.bridge.pid}/root`,
        `test ! -e /mnt/c/Windows && ! mountpoint -q /mnt/c && ! mountpoint -q /mnt/d`,
        `printf '{"uid":%s,"own_tool":true,"sibling_project":"blocked","sibling_socket":"blocked","sibling_process":"blocked","windows_mounts":"blocked"}\\n' "$(id -u)"`,
      ].join("\n")
      const child = Bun.spawn([path.resolve(restrictedShell), "-lc", command], {
        cwd: trial.project,
        env: {
          PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
          OPENCORVUS_BENCH_AGENT_UID: String(trial.uid),
          OPENCORVUS_BENCH_AGENT_HOME: trial.home,
        },
        stdout: "pipe",
        stderr: "pipe",
      })
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      if (exitCode !== 0) throw new Error(`Trial ${index + 1} isolation probe failed: ${stderr.trim() || exitCode}`)
      const audit = JSON.parse(stdout)
      if (audit.uid !== trial.uid) throw new Error(`Trial ${index + 1} used the wrong Agent UID`)
      return audit
    }),
  )

  const scores = await Promise.all(
    trials.map((trial) =>
      fetch(`${trial.adminURL}/admin/score`, {
        method: "POST",
        headers: { authorization: `Bearer ${trial.adminToken}`, "content-type": "application/json" },
        body: "{}",
      }).then((response) => response.json()),
    ),
  )
  if (scores.some((score: any) => score.tool_attempts !== 1 || score.tool_succeeded !== 1 || score.tool_failed !== 0)) {
    throw new Error(
      `A trial tool ledger observed sibling or missing calls: ${JSON.stringify(scores.map((score: any) => ({ attempts: score.tool_attempts, succeeded: score.tool_succeeded, failed: score.tool_failed })))}`,
    )
  }
  process.stdout.write(
    JSON.stringify({ ok: true, trials: probes.length, unique_uids: new Set(probes.map((item) => item.uid)).size, cross_trial: "blocked" }) + "\n",
  )
} finally {
  for (const trial of trials) trial.bridge.kill()
  await Promise.all(trials.map((trial) => trial.bridge.exited.catch(() => undefined)))
  await fs.rm(root, { recursive: true, force: true })
  await Promise.all(trials.map((trial) => fs.rm(trial.home, { recursive: true, force: true })))
}
