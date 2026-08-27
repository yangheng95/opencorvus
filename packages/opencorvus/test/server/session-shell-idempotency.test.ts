import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { createHash } from "node:crypto"
import path from "node:path"
import { readFile, stat, writeFile } from "node:fs/promises"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Provider, type Provider as ProviderType } from "../../src/provider/provider"
import {
  currentRuntimeProcessOccurrence,
  observedProcessOccurrence,
  observeRuntimeProcessOccurrence,
} from "../../src/runtime/process-occurrence"
import { serverErrorResponse } from "../../src/server/error-handler"
import { SessionRoutes } from "../../src/server/routes/session"
import { Session } from "../../src/session"
import { Message } from "../../src/session/message"
import { SessionShell } from "../../src/session/shell-exec"
import { ProcessSupervisor } from "../../src/shell/process-supervisor"
import { acquireControlLease, releaseControlLease } from "../../src/engine/control-lease"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const model = { providerID: "test", modelID: "direct-session-shell" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Direct Session Shell Test",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      interleaved: false,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
    },
    api: { id: model.modelID, url: "https://direct-session-shell.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-14",
  } as ProviderType.Model
}

function publicShellBody(messageID: string, command: string) {
  return { messageID, agent: "chat", model, command }
}

function publicShellIdentity(body: ReturnType<typeof publicShellBody>) {
  return {
    publicSessionPromptIdentity: {
      version: 1,
      fingerprint: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
    },
  }
}

async function persistShellOccurrence(input: {
  sessionID: string
  directory: string
  body: ReturnType<typeof publicShellBody>
  assistantCompleted?: number
  partState: Message.ToolPart["state"]
  processOwner?: ReturnType<typeof currentRuntimeProcessOccurrence>
  childProcess?: ReturnType<typeof observedProcessOccurrence>
  activeLease?: boolean
}) {
  const created = Date.now()
  const user: Message.User = {
    id: input.body.messageID,
    sessionID: input.sessionID,
    author: "user",
    time: { created },
    role: "user",
    agent: "chat",
    model,
    extra: publicShellIdentity(input.body),
  }
  await Session.persistMessage({
    info: user,
    parts: [
      {
        type: "text",
        id: Identifier.ascending("part"),
        messageID: user.id,
        sessionID: input.sessionID,
        text: "The following tool was executed by the user",
      },
    ],
  })
  const assistant: Message.Assistant = {
    id: Identifier.ascending("message"),
    sessionID: input.sessionID,
    author: "chat",
    parentID: user.id,
    acceptedInputMessageIDs: [user.id],
    agent: "chat",
    cost: 0,
    path: { cwd: input.directory, root: input.directory },
    time: { created, ...(input.assistantCompleted ? { completed: input.assistantCompleted } : {}) },
    role: "assistant",
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: model.modelID,
    providerID: model.providerID,
    ...(input.assistantCompleted ? { finish: "stop" } : {}),
  }
  const partID = Identifier.ascending("part")
  const callID = Identifier.ascending("call")
  const leaseID = Identifier.deterministic("call", `session-shell-lease\0${partID}`)
  const part: Message.ToolPart = {
    type: "tool",
    id: partID,
    messageID: assistant.id,
    sessionID: input.sessionID,
    tool: "bash",
    callID,
    ...(input.processOwner
      ? {
          metadata: SessionShell.processOwnershipMetadata(input.processOwner, {
            leaseID,
            ownerOccurrenceID: callID,
          }),
        }
      : {}),
    state: input.partState,
  }
  await Session.persistMessage({ info: assistant, parts: [part] })
  if (input.partState.status === "running" && input.childProcess) {
    await Session.appendToolProgress({
      sessionID: input.sessionID,
      messageID: assistant.id,
      partID: part.id,
      metadata: SessionShell.processChildOwnershipMetadata(input.childProcess),
    })
  }
  if (input.activeLease) {
    const acquired = acquireControlLease({
      target: "session_shell",
      targetID: part.id,
      ownerOccurrenceID: callID,
      leaseID,
      now: Date.now(),
      leaseMilliseconds: 30_000,
    })
    if (!acquired.acquired) throw new Error(`Could not acquire test shell lease ${leaseID}`)
  }
  return { assistant, part, lease: { leaseID, ownerOccurrenceID: callID } }
}

function shellRequest(app: Hono, sessionID: string, body: ReturnType<typeof publicShellBody>) {
  return app.fetch(
    new Request(`http://opencorvus.test/session/${sessionID}/shell`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("public Session shell identity", () => {
  test("two backend processes atomically publish one claimed input and its complete execution graph", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Session Message pair process test requires the repository test runtime")
    await using project = await memoryProject()
    const runtime = await createManagedTemporaryDirectory(processRoot, "session-message-pair-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "session-message-pair-barrier-")
    const worker = path.join(import.meta.dir, "..", "fixture", "session-message-pair-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: "init" | "claim" | "inspect", sessionID = "-", messageID = "-", label = "-") => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "..", "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          sessionID,
          messageID,
          label,
        ],
        { cwd: path.join(import.meta.dir, "..", ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as Record<string, unknown>
    }
    const waitFor = async (name: string) => {
      const target = path.join(barrier, name)
      const deadline = Date.now() + 30_000
      while (!(await stat(target).catch(() => undefined))) {
        if (Date.now() >= deadline) throw new Error(`Session Message pair worker did not reach ${name}`)
        await Bun.sleep(5)
      }
    }

    try {
      const initialized = await read(spawn("init"))
      const sessionID = String(initialized.sessionID)
      const messageID = Identifier.ascending("message")
      const first = spawn("claim", sessionID, messageID, "first")
      const second = spawn("claim", sessionID, messageID, "second")
      await Promise.all([waitFor("first.ready"), waitFor("second.ready")])
      await writeFile(path.join(barrier, "release"), "release")
      const results = await Promise.all([read(first), read(second)])
      const inspected = await read(spawn("inspect", sessionID, messageID))

      expect({
        results: results.map((result) => result.result).sort(),
        inspected,
      }).toEqual({
        results: ["claimed", "conflict"],
        inspected: {
          userCount: 1,
          assistantCount: 1,
          toolCount: 1,
          ownedToolCount: 1,
          exactLeaseCount: 1,
          shellLeaseRowCount: 1,
        },
      })
    } finally {
      for (const child of children) {
        child.kill()
        await child.exited
      }
      await removeManagedDirectoryTree(barrier)
      await removeManagedDirectoryTree(runtime)
    }
  }, 60_000)

  test("two backend shell routes converge on one production owner, lease, assistant, and command effect", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Session shell route process test requires the repository test runtime")
    await using project = await memoryProject()
    const runtime = await createManagedTemporaryDirectory(processRoot, "session-shell-route-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "session-shell-route-barrier-")
    const worker = path.join(import.meta.dir, "..", "fixture", "session-message-pair-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (
      mode: "init" | "route" | "inspect",
      sessionID = "-",
      messageID = "-",
      label = "-",
      command = "-",
    ) => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "..", "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          sessionID,
          messageID,
          label,
          command,
        ],
        { cwd: path.join(import.meta.dir, "..", ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as Record<string, unknown>
    }
    const waitFor = async (name: string) => {
      const target = path.join(barrier, name)
      const deadline = Date.now() + 30_000
      while (!(await stat(target).catch(() => undefined))) {
        if (Date.now() >= deadline) throw new Error(`Session shell route worker did not reach ${name}`)
        await Bun.sleep(5)
      }
    }

    try {
      const initialized = await read(spawn("init"))
      const sessionID = String(initialized.sessionID)
      const messageID = Identifier.ascending("message")
      const effectFile = path.join(project.path, "cross-process-shell-route-effect.txt").replaceAll("\\", "/")
      const command = `bun -e "require('fs').appendFileSync('${effectFile}','ran;'); await Bun.sleep(2000)"`
      const first = spawn("route", sessionID, messageID, "first-route", command)
      const second = spawn("route", sessionID, messageID, "second-route", command)
      await Promise.all([waitFor("first-route.ready"), waitFor("second-route.ready")])
      await writeFile(path.join(barrier, "release"), "release")
      const results = await Promise.all([read(first), read(second)])
      const inspected = await read(spawn("inspect", sessionID, messageID))
      const effectRuns = ((await readFile(effectFile, "utf8").catch(() => "")).match(/ran;/g) ?? []).length

      expect({
        statuses: results.map((result) => result.status),
        assistants: new Set(results.map((result) => result.assistantID)).size,
        toolStates: results.map((result) => result.toolState).sort(),
        effectRuns,
        inspected,
      }).toEqual({
        statuses: [200, 200],
        assistants: 1,
        toolStates: ["completed", "running"],
        effectRuns: 1,
        inspected: {
          userCount: 1,
          assistantCount: 1,
          toolCount: 1,
          ownedToolCount: 1,
          exactLeaseCount: 1,
          shellLeaseRowCount: 1,
        },
      })
    } finally {
      for (const child of children) {
        child.kill()
        await child.exited
      }
      await removeManagedDirectoryTree(barrier)
      await removeManagedDirectoryTree(runtime)
    }
  }, 90_000)

  test("a pre-admission hard exit closes the gated wrapper under the exact owner occurrence", async () => {
    await using project = await memoryProject()
    const effectFile = path.join(project.path, "gated-shell-hard-crash-effect.txt")
    const worker = path.join(import.meta.dir, "..", "fixture", "gated-shell-hard-crash-worker.ts")
    const child = Bun.spawn(
      [process.execPath, `--config=${path.join(import.meta.dir, "..", "empty-bunfig.toml")}`, worker, effectFile],
      {
        cwd: path.join(import.meta.dir, "..", ".."),
        env: process.env,
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    await Bun.sleep(1_000)

    expect({
      exitCode,
      stdout,
      stderr,
      effect: await readFile(effectFile, "utf8").catch(() => ""),
    }).toEqual({ exitCode: 86, stdout: "", stderr: "", effect: "" })
  }, 30_000)

  test("a lease lost during child admission settles interruption without opening the command gate", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Shell admission fence loss" })
        const effectFile = path.join(project.path, "admission-fence-loss-effect.txt").replaceAll("\\", "/")
        const body = publicShellBody(
          Identifier.ascending("message"),
          `bun -e "require('fs').writeFileSync('${effectFile}','ran')"`,
        )
        const originalSpawn = ProcessSupervisor.spawnHostShellGated
        let leaseReleased = false
        const spawn = spyOn(ProcessSupervisor, "spawnHostShellGated").mockImplementation((options, admit) =>
          originalSpawn(options, async (handle) => {
            const messages = await Session.messages({ sessionID: session.id })
            const assistant = messages.find(
              (message) =>
                message.info.role === "assistant" && Message.acceptsInputMessage(message.info, body.messageID),
            )
            const tool = assistant?.parts.find(
              (part): part is Message.ToolPart => part.type === "tool" && part.tool === "bash",
            )
            const ownership = tool ? SessionShell.processOwnership(tool) : undefined
            if (!tool || !ownership) throw new Error("Admission fence test could not resolve shell ownership")
            leaseReleased = releaseControlLease({
              target: "session_shell",
              targetID: tool.id,
              leaseID: ownership.leaseID,
              ownerOccurrenceID: ownership.leaseOwnerOccurrenceID,
              now: Date.now(),
            })
            return admit(handle)
          }),
        )
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const response = await shellRequest(app, session.id, body)
          const interrupted = (await response.json()) as any
          await Bun.sleep(1_000)

          expect({
            status: response.status,
            leaseReleased,
            finish: interrupted.info.finish,
            toolState: interrupted.parts[0]?.state.status,
            failureKind: interrupted.parts[0]?.state.failure?.kind,
            effect: await readFile(effectFile, "utf8").catch(() => ""),
          }).toEqual({
            status: 200,
            leaseReleased: true,
            finish: "error",
            toolState: "error",
            failureKind: "process-execution-interrupted",
            effect: "",
          })
        } finally {
          spawn.mockRestore()
        }
      },
    })
  }, 60_000)

  test("a terminal fence loss publishes one interruption outcome after the physical command settles", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Shell terminal fence loss" })
        const effectFile = path.join(project.path, "terminal-fence-loss-effect.txt").replaceAll("\\", "/")
        const body = publicShellBody(
          Identifier.ascending("message"),
          `bun -e "require('fs').writeFileSync('${effectFile}','ran')"`,
        )
        const originalTerminalWrite = Session.updateMessageAndPartWithCommit
        let leaseReleased = false
        const terminalWrite = spyOn(Session, "updateMessageAndPartWithCommit").mockImplementation(
          (input, beforeWrite, afterWrite) => {
            if (!leaseReleased && input.part.type === "tool" && input.part.state.status === "completed") {
              const ownership = SessionShell.processOwnership(input.part)
              if (!ownership) throw new Error("Terminal fence test could not resolve shell ownership")
              leaseReleased = releaseControlLease({
                target: "session_shell",
                targetID: input.part.id,
                leaseID: ownership.leaseID,
                ownerOccurrenceID: ownership.leaseOwnerOccurrenceID,
                now: Date.now(),
              })
            }
            return originalTerminalWrite(input, beforeWrite, afterWrite)
          },
        )
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const response = await shellRequest(app, session.id, body)
          const interrupted = (await response.json()) as any
          const replayResponse = await shellRequest(app, session.id, body)
          const replay = (await replayResponse.json()) as any

          expect({
            status: response.status,
            leaseReleased,
            terminalWrites: terminalWrite.mock.calls.length,
            finish: interrupted.info.finish,
            toolState: interrupted.parts[0]?.state.status,
            failureKind: interrupted.parts[0]?.state.failure?.kind,
            replayAssistant: replay.info.id,
            effect: await readFile(effectFile, "utf8").catch(() => ""),
          }).toEqual({
            status: 200,
            leaseReleased: true,
            terminalWrites: 1,
            finish: "error",
            toolState: "error",
            failureKind: "process-execution-interrupted",
            replayAssistant: interrupted.info.id,
            effect: "ran",
          })
        } finally {
          terminalWrite.mockRestore()
        }
      },
    })
  }, 60_000)

  test("a replayed shell request returns the durable occurrence without running the command again", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Shell replay identity" })
        const messageID = Identifier.ascending("message")
        const effectFile = path.join(project.path, "shell-replay-effect.txt").replaceAll("\\", "/")
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const body = publicShellBody(messageID, `bun -e "require('fs').appendFileSync('${effectFile}','ran;')"`)
          const send = () => shellRequest(app, session.id, body)

          const commandRuns = async () =>
            ((await readFile(effectFile, "utf8").catch(() => "")).match(/ran;/g) ?? []).length

          const firstResponse = await send()
          const first = (await firstResponse.json()) as any
          expect({
            status: firstResponse.status,
            role: first.info.role,
            parentID: first.info.parentID,
            finish: first.info.finish,
            toolPart: first.parts[0]?.tool,
            toolState: first.parts[0]?.state.status,
            commandRuns: await commandRuns(),
          }).toEqual({
            status: 200,
            role: "assistant",
            parentID: messageID,
            finish: "stop",
            toolPart: "bash",
            toolState: "completed",
            commandRuns: 1,
          })

          const retryResponse = await send()
          const retry = (await retryResponse.json()) as any
          expect({
            status: retryResponse.status,
            sameAssistant: retry.info.id === first.info.id,
            commandRuns: await commandRuns(),
          }).toEqual({
            status: 200,
            sameAssistant: true,
            commandRuns: 1,
          })
        } finally {
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("a replay terminalizes an abandoned shell occurrence without running its command", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Abandoned shell occurrence" })
        const effectFile = path.join(project.path, "abandoned-shell-effect.txt").replaceAll("\\", "/")
        const body = publicShellBody(
          Identifier.ascending("message"),
          `bun -e "require('fs').appendFileSync('${effectFile}','ran;')"`,
        )
        const current = currentRuntimeProcessOccurrence()
        const abandonedOwner = { ...current, processInstanceID: `${current.processInstanceID}:ended` }
        const started = Date.now() - 100
        const occurrence = await persistShellOccurrence({
          sessionID: session.id,
          directory: project.path,
          body,
          processOwner: abandonedOwner,
          partState: { status: "running", input: { command: body.command }, time: { start: started } },
        })
        const app = new Hono().route("/session", SessionRoutes())
        app.onError(serverErrorResponse)

        const response = await shellRequest(app, session.id, body)
        const recovered = (await response.json()) as any
        const replayResponse = await shellRequest(app, session.id, body)
        const replay = (await replayResponse.json()) as any
        const commandRuns = ((await readFile(effectFile, "utf8").catch(() => "")).match(/ran;/g) ?? []).length

        expect({
          status: response.status,
          sameAssistant: recovered.info.id === occurrence.assistant.id,
          assistantFinish: recovered.info.finish,
          assistantCompleted: typeof recovered.info.time.completed,
          toolState: recovered.parts[0]?.state.status,
          failureKind: recovered.parts[0]?.state.failure?.kind,
          replayStatus: replayResponse.status,
          replayAssistant: replay.info.id,
          commandRuns,
        }).toEqual({
          status: 200,
          sameAssistant: true,
          assistantFinish: "error",
          assistantCompleted: "number",
          toolState: "error",
          failureKind: "process-execution-interrupted",
          replayStatus: 200,
          replayAssistant: occurrence.assistant.id,
          commandRuns: 0,
        })
      },
    })
  })

  test("concurrent recovery writers converge on one deterministic interrupted outcome", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Concurrent shell recovery" })
        const body = publicShellBody(Identifier.ascending("message"), "echo never-replayed")
        const current = currentRuntimeProcessOccurrence()
        const occurrence = await persistShellOccurrence({
          sessionID: session.id,
          directory: project.path,
          body,
          processOwner: { ...current, processInstanceID: `${current.processInstanceID}:ended` },
          partState: {
            status: "running",
            input: { command: body.command },
            time: { start: Date.now() - 100 },
          },
        })

        const recovered = await Promise.all(
          Array.from({ length: 4 }, () =>
            SessionShell.terminalizeInterruptedOccurrence({
              sessionID: session.id,
              assistantMessageID: occurrence.assistant.id,
            }),
          ),
        )
        const durable = await Session.messages({ sessionID: session.id })
        const assistant = durable.find((message) => message.info.id === occurrence.assistant.id)
        const outcomes = recovered.map((message) => ({
          finish: message.info.role === "assistant" ? message.info.finish : undefined,
          completed: message.info.time.completed,
          toolState: message.parts[0]?.type === "tool" ? message.parts[0].state.status : undefined,
          failureKind:
            message.parts[0]?.type === "tool" && message.parts[0].state.status === "error"
              ? message.parts[0].state.failure.kind
              : undefined,
        }))

        expect({
          recovered: outcomes,
          distinctCompletedTimes: new Set(outcomes.map((outcome) => outcome.completed)).size,
          durableAssistantCount: durable.filter((message) => message.info.id === occurrence.assistant.id).length,
          durableFinish: assistant?.info.role === "assistant" ? assistant.info.finish : undefined,
        }).toEqual({
          recovered: Array.from({ length: 4 }, () => ({
            finish: "error",
            completed: outcomes[0]?.completed,
            toolState: "error",
            failureKind: "process-execution-interrupted",
          })),
          distinctCompletedTimes: 1,
          durableAssistantCount: 1,
          durableFinish: "error",
        })
      },
    })
  })

  test("a replay requires the exact shell lease even while its backend process remains live", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const peer = Bun.spawn([process.execPath, "-e", "await Bun.sleep(30000)"], {
          stdout: "ignore",
          stderr: "ignore",
        })
        try {
          const peerOwner = observedProcessOccurrence(peer.pid)
          if (!peerOwner) throw new Error(`Cannot observe live peer process ${peer.pid}`)
          const session = await Session.create({ kind: "assistant", title: "Live shell occurrence" })
          const body = publicShellBody(Identifier.ascending("message"), "echo must-not-rerun")
          const occurrence = await persistShellOccurrence({
            sessionID: session.id,
            directory: project.path,
            body,
            processOwner: peerOwner,
            activeLease: true,
            partState: {
              status: "running",
              input: { command: body.command },
              time: { start: Date.now() - 100 },
            },
          })
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)

          const response = await shellRequest(app, session.id, body)
          const inFlight = (await response.json()) as any
          expect({
            status: response.status,
            sameAssistant: inFlight.info.id === occurrence.assistant.id,
            assistantCompleted: inFlight.info.time.completed,
            toolState: inFlight.parts[0]?.state.status,
          }).toEqual({
            status: 200,
            sameAssistant: true,
            assistantCompleted: undefined,
            toolState: "running",
          })

          expect(
            releaseControlLease({
              target: "session_shell",
              targetID: occurrence.part.id,
              leaseID: occurrence.lease.leaseID,
              ownerOccurrenceID: occurrence.lease.ownerOccurrenceID,
              now: Date.now(),
            }),
          ).toBe(true)
          const abandonedResponse = await shellRequest(app, session.id, body)
          const abandoned = (await abandonedResponse.json()) as any
          expect({
            status: abandonedResponse.status,
            sameAssistant: abandoned.info.id === occurrence.assistant.id,
            backendStillLive: observeRuntimeProcessOccurrence(peerOwner),
            assistantFinish: abandoned.info.finish,
            toolState: abandoned.parts[0]?.state.status,
            failureKind: abandoned.parts[0]?.state.failure?.kind,
          }).toEqual({
            status: 200,
            sameAssistant: true,
            backendStillLive: "exact_live",
            assistantFinish: "error",
            toolState: "error",
            failureKind: "process-execution-interrupted",
          })
        } finally {
          peer.kill()
          await peer.exited
        }
      },
    })
  })

  test("a replay follows the exact live child occurrence without a backend-wide lease", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const child = Bun.spawn([process.execPath, "-e", "await Bun.sleep(30000)"], {
          stdout: "ignore",
          stderr: "ignore",
        })
        try {
          const childOccurrence = observedProcessOccurrence(child.pid)
          if (!childOccurrence) throw new Error(`Cannot observe live child process ${child.pid}`)
          const session = await Session.create({ kind: "assistant", title: "Live child shell occurrence" })
          const body = publicShellBody(Identifier.ascending("message"), "echo must-not-rerun")
          const current = currentRuntimeProcessOccurrence()
          const abandonedOwner = { ...current, processInstanceID: `${current.processInstanceID}:ended` }
          const occurrence = await persistShellOccurrence({
            sessionID: session.id,
            directory: project.path,
            body,
            processOwner: abandonedOwner,
            childProcess: childOccurrence,
            partState: {
              status: "running",
              input: { command: body.command },
              time: { start: Date.now() - 100 },
            },
          })
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)

          const durableBeforeReplay = await Session.messages({ sessionID: session.id })
          const durableAssistant = durableBeforeReplay.find((message) => message.info.id === occurrence.assistant.id)
          const durableTool = durableAssistant?.parts.find(
            (candidate): candidate is Message.ToolPart => candidate.type === "tool",
          )
          expect({
            physical: observeRuntimeProcessOccurrence(childOccurrence),
            persistedChild: durableTool ? SessionShell.processOwnership(durableTool)?.child : undefined,
          }).toEqual({ physical: "exact_live", persistedChild: childOccurrence })

          const liveResponse = await shellRequest(app, session.id, body)
          const live = (await liveResponse.json()) as any
          expect({
            status: liveResponse.status,
            sameAssistant: live.info.id === occurrence.assistant.id,
            toolState: live.parts[0]?.state.status,
          }).toEqual({ status: 200, sameAssistant: true, toolState: "running" })

          child.kill()
          await child.exited
          const deadline = Date.now() + 5_000
          while (observeRuntimeProcessOccurrence(childOccurrence) !== "dead_or_reused") {
            if (Date.now() >= deadline) throw new Error(`Child occurrence ${childOccurrence.occurrenceID} stayed live`)
            await Bun.sleep(20)
          }
          const endedResponse = await shellRequest(app, session.id, body)
          const ended = (await endedResponse.json()) as any
          expect({
            status: endedResponse.status,
            sameAssistant: ended.info.id === occurrence.assistant.id,
            finish: ended.info.finish,
            toolState: ended.parts[0]?.state.status,
            failureKind: ended.parts[0]?.state.failure?.kind,
          }).toEqual({
            status: 200,
            sameAssistant: true,
            finish: "error",
            toolState: "error",
            failureKind: "process-execution-interrupted",
          })
        } finally {
          child.kill()
          await child.exited
        }
      },
    })
  })

  test("a caught spawn failure settles the existing Tool and assistant before replay", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Shell spawn failure" })
        const body = publicShellBody(Identifier.ascending("message"), "echo never-started")
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const spawn = spyOn(ProcessSupervisor, "spawnHostShellGated").mockRejectedValue(new Error("spawn refused"))
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const response = await shellRequest(app, session.id, body)
          const failed = (await response.json()) as any
          const replayResponse = await shellRequest(app, session.id, body)
          const replay = (await replayResponse.json()) as any

          expect({
            status: response.status,
            assistantFinish: failed.info.finish,
            assistantCompleted: typeof failed.info.time.completed,
            toolState: failed.parts[0]?.state.status,
            failureKind: failed.parts[0]?.state.failure?.kind,
            replayStatus: replayResponse.status,
            sameAssistant: replay.info.id === failed.info.id,
            spawnCalls: spawn.mock.calls.length,
          }).toEqual({
            status: 200,
            assistantFinish: "error",
            assistantCompleted: "number",
            toolState: "error",
            failureKind: "session-shell-execution-failed",
            replayStatus: 200,
            sameAssistant: true,
            spawnCalls: 1,
          })
        } finally {
          spawn.mockRestore()
          provider.mockRestore()
        }
      },
    })
  })

  test("a post-spawn progress failure physically settles the child before the occurrence errors", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Shell progress failure" })
        const effectFile = path.join(project.path, "progress-failure-effect.txt").replaceAll("\\", "/")
        const body = publicShellBody(
          Identifier.ascending("message"),
          `bun -e "await Bun.sleep(5000); require('fs').writeFileSync('${effectFile}','ran')"`,
        )
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const progress = spyOn(Session, "appendToolProgressWithCommit").mockRejectedValue(
          new Error("progress store refused"),
        )
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const response = await shellRequest(app, session.id, body)
          const failed = (await response.json()) as any
          const effect = await readFile(effectFile, "utf8").catch(() => "")

          expect({
            status: response.status,
            assistantFinish: failed.info.finish,
            toolState: failed.parts[0]?.state.status,
            failureKind: failed.parts[0]?.state.failure?.kind,
            progressWrites: progress.mock.calls.length,
            effect,
          }).toEqual({
            status: 200,
            assistantFinish: "error",
            toolState: "error",
            failureKind: "session-shell-execution-failed",
            progressWrites: 1,
            effect: "",
          })
        } finally {
          progress.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("a failed completion write settles the durable running Tool before the assistant errors", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Shell terminal persistence failure" })
        const body = publicShellBody(Identifier.ascending("message"), "echo terminal-write-failure")
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const originalTerminalWrite = Session.updateMessageAndPartWithCommit
        let rejectedCompletion = false
        const terminalWrite = spyOn(Session, "updateMessageAndPartWithCommit").mockImplementation(
          (input, beforeWrite, afterWrite) => {
            if (!rejectedCompletion && input.part.type === "tool" && input.part.state.status === "completed") {
              rejectedCompletion = true
              throw new Error("completion store refused")
            }
            return originalTerminalWrite(input, beforeWrite, afterWrite)
          },
        )
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const response = await shellRequest(app, session.id, body)
          const failed = (await response.json()) as any
          const durable = await Session.messages({ sessionID: session.id })
          const assistant = durable.find((message) => message.info.id === failed.info.id)
          const tool = assistant?.parts.find((candidate) => candidate.type === "tool") as Message.ToolPart | undefined

          expect({
            status: response.status,
            rejectedCompletion,
            responseFinish: failed.info.finish,
            responseToolState: failed.parts[0]?.state.status,
            durableFinish: assistant?.info.role === "assistant" ? assistant.info.finish : undefined,
            durableToolState: tool?.state.status,
            durableFailureKind: tool?.state.status === "error" ? tool.state.failure.kind : undefined,
          }).toEqual({
            status: 200,
            rejectedCompletion: true,
            responseFinish: "error",
            responseToolState: "error",
            durableFinish: "error",
            durableToolState: "error",
            durableFailureKind: "session-shell-execution-failed",
          })
        } finally {
          terminalWrite.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("a replay completes the same assistant when its Tool terminal was durable first", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Terminal Tool crash cut" })
        const body = publicShellBody(Identifier.ascending("message"), "echo already-finished")
        const started = Date.now() - 100
        const ended = started + 50
        const occurrence = await persistShellOccurrence({
          sessionID: session.id,
          directory: project.path,
          body,
          partState: {
            status: "completed",
            input: { command: body.command },
            output: "already-finished",
            title: "",
            metadata: { output: "already-finished", description: "" },
            time: { start: started, end: ended },
          },
        })
        const app = new Hono().route("/session", SessionRoutes())
        app.onError(serverErrorResponse)

        const response = await shellRequest(app, session.id, body)
        const completed = (await response.json()) as any
        expect({
          status: response.status,
          sameAssistant: completed.info.id === occurrence.assistant.id,
          finish: completed.info.finish,
          assistantCompleted: completed.info.time.completed,
          toolState: completed.parts[0]?.state.status,
        }).toEqual({
          status: 200,
          sameAssistant: true,
          finish: "stop",
          assistantCompleted: ended,
          toolState: "completed",
        })
      },
    })
  })

  test("a replay terminalizes the historical open Tool under an immutable completed assistant", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Completed assistant crash cut" })
        const body = publicShellBody(Identifier.ascending("message"), "echo completion-was-written-first")
        const current = currentRuntimeProcessOccurrence()
        const abandonedOwner = { ...current, processInstanceID: `${current.processInstanceID}:ended` }
        const started = Date.now() - 100
        const assistantCompleted = started + 50
        const occurrence = await persistShellOccurrence({
          sessionID: session.id,
          directory: project.path,
          body,
          assistantCompleted,
          processOwner: abandonedOwner,
          partState: { status: "running", input: { command: body.command }, time: { start: started } },
        })
        const app = new Hono().route("/session", SessionRoutes())
        app.onError(serverErrorResponse)

        const response = await shellRequest(app, session.id, body)
        const completed = (await response.json()) as any
        expect({
          status: response.status,
          sameAssistant: completed.info.id === occurrence.assistant.id,
          finish: completed.info.finish,
          assistantCompleted: completed.info.time.completed,
          toolState: completed.parts[0]?.state.status,
          failureKind: completed.parts[0]?.state.failure?.kind,
        }).toEqual({
          status: 200,
          sameAssistant: true,
          finish: "stop",
          assistantCompleted,
          toolState: "error",
          failureKind: "process-execution-interrupted",
        })
      },
    })
  })
})
