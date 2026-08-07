import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises"
import { createHash } from "node:crypto"
import os from "node:os"
import path from "node:path"
import {
  createOciTaskExec,
  disposeOciTaskContainer,
  OciTaskContainerUnavailableError,
  type OciTaskContainerDescriptor,
} from "../../src/execution-capsule/oci-task-container"
import { Filesystem } from "../../src/util/filesystem"

const controllerUnit = process.argv[2]
if (!controllerUnit) throw new Error("controller unit is required")
const frozenToolchainRoot = process.argv[3] || "/"
const probeMode = process.argv[4] || "loopback-isolation"
const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-oci-contract-"))
const workspaceA = path.join(root, "workspace-a")
const workspaceB = path.join(root, "workspace-b")
await Promise.all([mkdir(workspaceA), mkdir(workspaceB)])

const descriptor: OciTaskContainerDescriptor = {
  controllerUnit,
  outerSourceRoot: root,
  outerVisibleRoot: root,
  runc: "/usr/sbin/runc",
  systemctl: "/usr/bin/systemctl",
  systemdRun: "/usr/bin/systemd-run",
  toolchainRoot: frozenToolchainRoot,
  resources: {
    memoryMaxBytes: 536_870_912,
    tasksMax: 128,
    nofileMax: 1024,
    tmpfsMaxBytes: 134_217_728,
    cpuQuotaPercent: 100,
  },
}
const brokerEnvironment = {
  PATH: "/usr/local/bin:/usr/bin:/bin",
  LANG: "C.UTF-8",
  XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
  DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS,
}

async function command(taskID: string, sourceRoot: string, executable: string, args: string[]) {
  return createOciTaskExec({
    descriptor,
    taskID,
    sourceRoot,
    command: { executable, args, environment: [], cwd: "/workspace" },
    brokerEnvironment,
  })
}

async function waitForActivity(file: string, child: ReturnType<typeof Bun.spawn>) {
  let lastActivity = Date.now()
  for (;;) {
    const ready = await readFile(file, "utf8").catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined
      throw error
    })
    if (ready === "ready") return
    if (child.exitCode !== null) {
      const stderr = await new Response(child.stderr).text()
      throw new Error(`Server exited ${child.exitCode} before readiness: ${stderr}`)
    }
    if (Date.now() - lastActivity >= 5_000) throw new Error(`No server readiness activity for ${file}`)
    await Bun.sleep(50)
  }
}

async function waitForTerminalUnit(taskID: string) {
  const unit = taskContainerUnit(taskID)
  let lastObservation = ""
  let lastActivity = Date.now()
  for (;;) {
    const child = Bun.spawn(
      [descriptor.systemctl, "--user", "show", unit, "--property=ActiveState,SubState,ExecMainStatus"],
      { cwd: root, env: brokerEnvironment, stdout: "pipe", stderr: "pipe" },
    )
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    const observation = `${code}:${stdout}:${stderr}`
    if (observation !== lastObservation) {
      lastObservation = observation
      lastActivity = Date.now()
    }
    if (code === 0 && stdout.includes("ActiveState=active") && stdout.includes("SubState=exited")) return
    if (Date.now() - lastActivity >= 5_000) throw new Error(`No terminal unit activity after ${lastObservation}`)
    await Bun.sleep(50)
  }
}

function taskContainerIdentity(taskID: string) {
  return createHash("sha256").update(`${controllerUnit}\0${taskID}`).digest("hex").slice(0, 32)
}

function taskContainerUnit(taskID: string) {
  return `opencorvus-task-container-${taskContainerIdentity(taskID)}.service`
}

async function hostCommand(executable: string, args: string[]) {
  const child = Bun.spawn([executable, ...args], { cwd: root, env: brokerEnvironment, stdout: "pipe", stderr: "pipe" })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { code, stdout: stdout.trim(), stderr: stderr.trim() }
}

async function startServer(taskID: string, sourceRoot: string, response: string) {
  if (frozenToolchainRoot !== "/") {
    const script = [
      "const fs=require('node:fs')",
      "const http=require('node:http')",
      `http.createServer((_req,res)=>res.end(${JSON.stringify(response)})).listen(18800,'127.0.0.1',()=>fs.writeFileSync('/workspace/server-ready','ready'))`,
    ].join(";")
    const wrapped = await command(taskID, sourceRoot, "/usr/local/bin/node", ["-e", script])
    const child = Bun.spawn([wrapped.executable, ...wrapped.args], {
      cwd: wrapped.cwd,
      env: wrapped.env,
      stdout: "pipe",
      stderr: "pipe",
    })
    await waitForActivity(path.join(sourceRoot, "server-ready"), child)
    return child
  }
  const script = [
    "from http.server import BaseHTTPRequestHandler,HTTPServer",
    "from pathlib import Path",
    `response=${JSON.stringify(response)}.encode()`,
    "class Handler(BaseHTTPRequestHandler):\n def do_GET(self):\n  self.send_response(200); self.end_headers(); self.wfile.write(response)\n def log_message(self,*args): pass",
    "server=HTTPServer(('127.0.0.1',18800),Handler)",
    "Path('/workspace/server-ready').write_text('ready')",
    "server.serve_forever()",
  ].join("\n")
  const wrapped = await command(taskID, sourceRoot, "/usr/bin/python3", ["-c", script])
  const child = Bun.spawn([wrapped.executable, ...wrapped.args], {
    cwd: wrapped.cwd,
    env: wrapped.env,
    stdout: "pipe",
    stderr: "pipe",
  })
  await waitForActivity(path.join(sourceRoot, "server-ready"), child)
  return child
}

async function request(taskID: string, sourceRoot: string) {
  const wrapped =
    frozenToolchainRoot === "/"
      ? await command(taskID, sourceRoot, "/usr/bin/python3", [
          "-c",
          "import urllib.request,sys; sys.stdout.write(urllib.request.urlopen('http://127.0.0.1:18800').read().decode())",
        ])
      : await command(taskID, sourceRoot, "/usr/local/bin/node", [
          "-e",
          "fetch('http://127.0.0.1:18800').then(async response=>process.stdout.write(await response.text()))",
        ])
  const child = Bun.spawn([wrapped.executable, ...wrapped.args], {
    cwd: wrapped.cwd,
    env: wrapped.env,
    stdout: "pipe",
    stderr: "pipe",
  })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (code !== 0) throw new Error(`OCI request failed with ${code}: ${stderr}`)
  return stdout
}

try {
  if (probeMode === "terminal-evidence" || probeMode === "terminal-evidence-recovery") {
    await command("task-a", workspaceA, "/usr/bin/true", [])
    const containerID = `opencorvus-${taskContainerIdentity("task-a")}`
    const terminator = Bun.spawn([descriptor.runc, "--root", path.join(root, "control", "runc-state"), "kill", "--all", containerID, "KILL"], {
      cwd: root,
      env: brokerEnvironment,
      stdout: "pipe",
      stderr: "pipe",
    })
    const terminateCode = await terminator.exited
    if (terminateCode !== 0) throw new Error(`Container init termination failed with ${terminateCode}`)
    await waitForTerminalUnit("task-a")
    const evidencePath = path.join(
      root,
      "control",
      "task-containers",
      taskContainerIdentity("task-a"),
      "terminal-evidence.json",
    )
    let evidenceBeforeReplay: string | undefined
    if (probeMode === "terminal-evidence-recovery") {
      const unitName = taskContainerUnit("task-a")
      const [unitProperties, unitStatus] = await Promise.all([
        hostCommand(descriptor.systemctl, [
          "--user",
          "show",
          unitName,
          "--all",
          "--property=ActiveState,SubState,Result,ExecMainCode,ExecMainStatus,StatusText",
        ]),
        hostCommand(descriptor.systemctl, ["--user", "status", unitName, "--no-pager", "--full", "--lines=80"]),
      ])
      await Filesystem.writeAtomicIfAbsent(
        evidencePath,
        `${JSON.stringify({
          schema_version: 1,
          container_id: `opencorvus-${taskContainerIdentity("task-a")}`,
          unit_name: unitName,
          observation: "simulated-crash-after-terminal-evidence",
          unit_properties: unitProperties,
          unit_status: unitStatus,
        }, null, 2)}\n`,
        0o600,
      )
      evidenceBeforeReplay = await readFile(evidencePath, "utf8")
    }

    async function observeTerminalEvidence() {
      try {
        await command("task-a", workspaceA, "/usr/bin/true", [])
        throw new Error("Unexpectedly prepared a second OCI process after terminal container failure")
      } catch (error) {
        if (!(error instanceof OciTaskContainerUnavailableError) || !error.diagnostics) throw error
        return {
          code: error.code,
          message: error.message,
          unitProperties: error.diagnostics.unitProperties,
          unitStatus: error.diagnostics.unitStatus,
        }
      }
    }

    const first = await observeTerminalEvidence()
    const recovery = probeMode === "terminal-evidence-recovery"
      ? {
          evidenceBytesEqual: evidenceBeforeReplay === await readFile(evidencePath, "utf8"),
          unit: await hostCommand(descriptor.systemctl, [
            "--user",
            "show",
            taskContainerUnit("task-a"),
            "--property=ActiveState,SubState",
          ]),
          inventory: await hostCommand(descriptor.runc, [
            "--root",
            path.join(root, "control", "runc-state"),
            "list",
            "--format",
            "json",
          ]),
        }
      : undefined
    const replay = await observeTerminalEvidence()
    process.stdout.write(`${JSON.stringify({ first, recovery, replay })}\n`)
  } else {
    const [serverA, serverB] = await Promise.all([
      startServer("task-a", workspaceA, "A"),
      startServer("task-b", workspaceB, "B"),
    ])
    const responses = await Promise.all([request("task-a", workspaceA), request("task-b", workspaceB)])
    process.stdout.write(`${responses.join("\n")}\n`)
    if (frozenToolchainRoot !== "/") {
      const browser = await command("task-a", workspaceA, "/usr/local/bin/node", [
        "-e",
        "const {chromium}=require('/opt/opencorvus-browser/node_modules/playwright/index.js');(async()=>{const browser=await chromium.launch({executablePath:'/opt/opencorvus-browser/chromium/chrome-headless-shell',headless:true,args:['--no-sandbox']});const page=await browser.newPage();await page.goto('http://127.0.0.1:18800');process.stdout.write(await page.textContent('body'));await browser.close()})()",
      ])
      const child = Bun.spawn([browser.executable, ...browser.args], {
        cwd: browser.cwd,
        env: browser.env,
        stdout: "pipe",
        stderr: "pipe",
      })
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      if (code !== 0) throw new Error(`OCI browser failed with ${code}: ${stderr}`)
      process.stdout.write(`BROWSER=${stdout}\n`)
    }
    await Promise.all([
      disposeOciTaskContainer({ descriptor, taskID: "task-a", brokerEnvironment }),
      disposeOciTaskContainer({ descriptor, taskID: "task-b", brokerEnvironment }),
    ])
    await Promise.all([serverA.exited, serverB.exited])
  }
} finally {
  await rm(root, { recursive: true, force: true })
}
