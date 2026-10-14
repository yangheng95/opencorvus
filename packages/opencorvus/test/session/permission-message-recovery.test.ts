import { afterEach, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { setTimeout as pause } from "node:timers/promises"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { Instance } from "../../src/project/instance"
import { Config } from "../../src/config/config"
import { Bus } from "../../src/bus"
import { PermissionAuthority } from "../../src/permission/authority"
import { Session } from "../../src/session"
import { SessionPromptState } from "../../src/session/prompt/state"
import { SessionPromptOwner } from "../../src/session/prompt/owner"
import { SessionLoop } from "../../src/session/loop"
import { MessageStore } from "../../src/session/message-store"
import { Message } from "../../src/session/message"
import { Identifier } from "../../src/id/id"
import { recordProviderActivityEvent } from "../../src/session/provider-activity-facts"
import { completedReadResult, resultRecoveryModel } from "../fixture/completed-read-result"
import { startControlledStreamingProvider } from "../fixture/controlled-streaming-provider"
import { permissionMessageResult } from "../fixture/permission-message-result"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

async function withSource(body: (scope: string, filePath: string) => Promise<void>) {
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw new Error("Isolated test runtime required")
  const scope = await createManagedTemporaryDirectory(root, "permission-message-")
  try {
    const filePath = path.join(scope, "source.txt")
    await fs.writeFile(filePath, "Permission recovery belongs to its complete message.\n")
    await body(scope, filePath)
  } finally {
    await removeManagedDirectoryTree(scope)
  }
}

async function configureProvider(apiURL: string) {
  const model = resultRecoveryModel
  await Config.updateGlobalPatch({
    model: `${model.providerID}/${model.id}`,
    provider: {
      [model.providerID]: {
        name: "Recovery streaming contract",
        npm: "@ai-sdk/openai-compatible",
        api: apiURL,
        models: {
          [model.id]: {
            name: "Recovery streaming contract",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1000000, output: 4096 },
          },
        },
      },
    },
  })
}

test("a settled invocation leaves its message available for the remaining accepted Tool", async () => {
  await using project = await memoryProject()
  await withSource(async (_scope, filePath) => {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const first = await permissionMessageResult(filePath)
        const asked = Promise.withResolvers<PermissionAuthority.Request>()
        const decision = Promise.withResolvers<void>()
        const pending = completedReadResult({
          mode: "ask",
          filePath,
          session: first.session,
          message: first.assistant,
          approve: async (request) => {
            asked.resolve(request)
            await decision.promise
            await PermissionAuthority.reply({
              requestID: request.id,
              decision: "allow_once",
              actorID: "remaining-tool-contract",
            })
          },
        })
        const request = await asked.promise
        const identity = { sessionID: first.session.id, messageID: first.assistant.id }
        const before = await MessageStore.get(identity)
        let outcome: unknown
        try {
          outcome = await SessionLoop.resumePermissionContinuation(first.request)
        } catch (error) {
          outcome = { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
        }
        const after = await MessageStore.get(identity)
        console.log(
          "permission-message-evidence " + JSON.stringify({ scenario: "remaining-tool", outcome, before, after }),
        )
        try {
          expect(outcome).toBe("resumed")
          expect(after.info).toEqual(before.info)
          expect(after.parts.find((part) => part.type === "tool" && part.callID === request.toolCallID)).toMatchObject({
            state: { status: "running" },
          })
        } finally {
          decision.resolve()
        }
        const second = await pending
        await second.processor.completeRecoveredToolPart({
          toolCallID: second.callID,
          toolInput: second.args,
          output: second.result,
        })
        expect(
          (await MessageStore.parts(first.assistant.id))
            .filter((part) => part.type === "tool")
            .map((part) => part.state.status),
        ).toEqual(["completed", "completed"])
        expect([first.executeCount(), second.executeCount()]).toEqual([1, 1])
      },
    })
  })
}, 60_000)

for (const abandonedProvider of [false, true]) {
  test(`successful peer receipts settle before a fresh streaming Turn executes its own Tool (interrupted Provider: ${abandonedProvider})`, async () => {
    await using project = await memoryProject()
    await withSource(async (_scope, filePath) => {
      const provider = startControlledStreamingProvider({
        firstPromptToolCall: {
          name: "read",
          arguments: { filePath, offset: 1, limit: 1 },
        },
      })
      const release = setInterval(() => {
        for (const request of provider.requests) request.release()
      }, 5)
      try {
        await Instance.provide({
          directory: project.path,
          fn: async () => {
            await configureProvider(provider.apiURL)
            const first = await permissionMessageResult(filePath)
            const second = await completedReadResult({
              mode: "ask",
              filePath,
              session: first.session,
              message: first.assistant,
            })
            if (abandonedProvider)
              recordProviderActivityEvent(first.assistant.id, {
                type: "started",
                id: Identifier.ascending("part"),
                ts: Date.now(),
                sessionID: first.session.id,
                provider: first.assistant.providerID,
                model: first.assistant.modelID,
              })
            const stop = Bus.subscribe(PermissionAuthority.Event.Asked, async ({ properties }) => {
              if (properties.sessionID === first.session.id)
                await PermissionAuthority.reply({
                  requestID: properties.id,
                  decision: "allow_once",
                  actorID: "new-streaming-tool-contract",
                })
            })
            try {
              expect(await SessionLoop.resumePermissionContinuation(first.request)).toBe("resumed")
              const messages = await Session.messages({ sessionID: first.session.id })
              const recovered = messages.find((message) => message.info.id === first.assistant.id)!
              const nextTool = messages
                .flatMap((message) => message.parts)
                .find((part) => part.type === "tool" && part.callID === "call_controlled_recovery_next")
              console.log(
                "permission-message-evidence " +
                  JSON.stringify({
                    scenario: "fresh-streaming-tool",
                    abandonedProvider,
                    messages,
                    requests: provider.requests.map((request) => ({ kind: request.kind, body: request.body })),
                  }),
              )
              expect(recovered.parts.filter((part) => part.type === "tool").map((part) => part.state.status)).toEqual([
                "completed",
                "completed",
              ])
              expect(recovered.info.time.completed).toBeNumber()
              expect(recovered.info.role === "assistant" ? recovered.info.finish : undefined).toBe(
                abandonedProvider ? "error" : "tool-calls",
              )
              expect(nextTool).toMatchObject({
                type: "tool",
                state: { status: "completed", output: first.result.output },
              })
              expect(
                messages
                  .flatMap((message) => message.parts)
                  .filter((part) => part.type === "text")
                  .map((part) => part.text),
              ).toContain("provider reply 2")
              expect([first.executeCount(), second.executeCount()]).toEqual([1, 1])
              expect(provider.promptRequests().map((request) => (request.body as { stream: boolean }).stream)).toEqual([
                true,
                true,
              ])
            } finally {
              stop()
            }
          },
        })
      } finally {
        clearInterval(release)
        await provider.server.stop(true)
      }
    })
  }, 120_000)
}

test("an approval arriving during owner release is recovered through a new physical generation", async () => {
  await using project = await memoryProject()
  await withSource(async (_scope, filePath) => {
    const provider = startControlledStreamingProvider()
    const release = setInterval(() => {
      for (const request of provider.requests) request.release()
    }, 5)
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await configureProvider(provider.apiURL)
          const first = await permissionMessageResult(filePath)
          const asked = Promise.withResolvers<PermissionAuthority.Request>(),
            decision = Promise.withResolvers<void>()
          const secondResult = completedReadResult({
            mode: "ask",
            filePath,
            session: first.session,
            message: first.assistant,
            approve: async (request) => {
              asked.resolve(request)
              await decision.promise
              await PermissionAuthority.reply({
                requestID: request.id,
                decision: "allow_once",
                actorID: "release-window",
              })
            },
          })
          const secondRequest = await asked.promise
          let intercepted = false
          let peerOutcome: unknown
          const generations: string[] = []
          const finish = SessionPromptState.finish
          using boundary = spyOn(SessionPromptState, "finish").mockImplementation(
            async (sessionID, abort, directory, reason) => {
              if (sessionID === first.session.id && !intercepted) {
                intercepted = true
                generations.push(SessionPromptOwner.current(sessionID)!.generation)
                decision.resolve()
                await secondResult
                peerOutcome = await SessionLoop.resumePermissionContinuation(secondRequest)
              }
              return finish(sessionID, abort, directory, reason)
            },
          )
          const stop = Bus.subscribe(Message.Event.Created, ({ properties }) => {
            if (properties.info.sessionID !== first.session.id || properties.info.role !== "assistant") return
            const owner = SessionPromptOwner.current(first.session.id)
            if (owner && !generations.includes(owner.generation)) generations.push(owner.generation)
          })
          try {
            expect(await SessionLoop.resumePermissionContinuation(first.request)).toBe("resumed")
            const messages = await Session.messages({ sessionID: first.session.id })
            console.log(
              "permission-message-evidence " +
                JSON.stringify({ scenario: "approval-during-release", peerOutcome, generations, messages }),
            )
            expect(peerOutcome).toBe("live")
            expect(new Set(generations).size).toBe(2)
            expect(
              messages
                .find((message) => message.info.id === first.assistant.id)
                ?.parts.filter((part) => part.type === "tool")
                .map((part) => part.state.status),
            ).toEqual(["completed", "completed"])
            expect(provider.promptRequests().map((request) => (request.body as { stream: boolean }).stream)).toEqual([
              true,
            ])
            expect((await secondResult).executeCount()).toBe(1)
          } finally {
            stop()
            decision.resolve()
            await secondResult
          }
        },
      })
    } finally {
      clearInterval(release)
      await provider.server.stop(true)
    }
  })
}, 120_000)

test("concurrent continuations converge one complete Message before one streaming reply", async () => {
  await using project = await memoryProject()
  await withSource(async (_scope, filePath) => {
    const provider = startControlledStreamingProvider()
    const release = setInterval(() => {
      for (const request of provider.requests) request.release()
    }, 5)
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await configureProvider(provider.apiURL)
          const first = await permissionMessageResult(filePath)
          const second = await completedReadResult({
            mode: "ask",
            filePath,
            session: first.session,
            message: first.assistant,
          })
          const secondRequest = PermissionAuthority.approvedMessageContinuations(first.request).find(
            (request) => request.toolCallID === second.callID,
          )!
          const outcomes = await Promise.all([
            SessionLoop.resumePermissionContinuation(first.request),
            SessionLoop.resumePermissionContinuation(secondRequest),
          ])
          expect(outcomes).toContain("resumed")
          expect(outcomes.filter((outcome) => outcome === "live" || outcome === "resumed")).toHaveLength(2)
          const identity = { sessionID: first.session.id, messageID: first.assistant.id }
          const settled = await MessageStore.get(identity)
          expect(settled.parts.filter((part) => part.type === "tool").map((part) => part.state.status)).toEqual([
            "completed",
            "completed",
          ])
          expect(await SessionLoop.resumePermissionContinuation(first.request)).toBe("resumed")
          expect(await MessageStore.get(identity)).toEqual(settled)
          const concluded = await PermissionAuthority.history()
          await PermissionAuthority.resumeApprovedContinuations()
          expect(await PermissionAuthority.history()).toEqual(concluded)
          expect(provider.promptRequests().map((request) => (request.body as { stream: boolean }).stream)).toEqual([
            true,
          ])
        },
      })
    } finally {
      clearInterval(release)
      await provider.server.stop(true)
    }
  })
}, 120_000)

test("a live peer process retains the exact message it owns during permission recovery", async () => {
  await using project = await memoryProject()
  await withSource(async (scope, filePath) => {
    const stateFile = path.join(scope, "owner.json")
    const worker = path.resolve(import.meta.dir, "../fixture/permission-message-owner-worker.ts")
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: string) => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.resolve(import.meta.dir, "../empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          filePath,
          stateFile,
        ],
        {
          cwd: path.resolve(import.meta.dir, "../.."),
          env: { ...process.env, OPENCORVUS_HOME: path.join(scope, "runtime") },
          stdin: "pipe",
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      children.push(child)
      return child
    }
    const holder = spawn("hold")
    const holderOutput = Promise.all([new Response(holder.stdout).text(), new Response(holder.stderr).text()])
    try {
      const deadline = Date.now() + 60_000
      while (true) {
        try {
          JSON.parse(await fs.readFile(stateFile, "utf8"))
          break
        } catch (error) {
          if (holder.exitCode !== null) throw new Error(`Owner exited ${holder.exitCode}: ${(await holderOutput)[1]}`)
          if (Date.now() > deadline) throw new Error("Actual live owner readiness deadline exceeded", { cause: error })
          await pause(20)
        }
      }
      const inspector = spawn("inspect")
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(inspector.stdout).text(),
        new Response(inspector.stderr).text(),
        inspector.exited,
      ])
      expect(exitCode, stderr).toBe(0)
      const evidence = JSON.parse(stdout)
      console.log("permission-message-evidence " + JSON.stringify({ scenario: "live-peer", ...evidence }))
      expect(evidence.observed).toMatchObject({ observation: "exact_live", authority: { owner_pid: holder.pid } })
      expect(evidence.outcome).toBe("live")
      expect(evidence.after).toEqual(evidence.before)
      expect(evidence.currentOwner).toEqual(evidence.state.owner)
    } finally {
      if (holder.exitCode === null) {
        holder.stdin.write("release\n")
        holder.stdin.end()
      }
      await holder.exited
      await holderOutput
      for (const child of children) if (child.exitCode === null) child.kill()
      await Promise.all(children.map((child) => child.exited))
    }
  })
}, 120_000)
