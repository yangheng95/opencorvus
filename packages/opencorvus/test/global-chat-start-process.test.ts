import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

function startStreamingProvider() {
  const requests: Array<{ kind: "memory" | "prompt"; body: unknown }> = []
  const promptGate = Promise.withResolvers<void>()
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    idleTimeout: 255,
    async fetch(request) {
      const body = await request.json().catch(() => undefined)
      const messages = Array.isArray((body as any)?.messages) ? (body as any).messages : []
      const kind = messages.some(
        (message: any) =>
          message?.role === "system" &&
          typeof message.content === "string" &&
          message.content.includes("dedicated Memory Organizer"),
      )
        ? ("memory" as const)
        : ("prompt" as const)
      requests.push({ kind, body })
      const memoryInstruction = messages.find((message: any) => message?.role === "user")?.content
      const coveredOccurrenceIDs =
        kind === "memory" && typeof memoryInstruction === "string"
          ? JSON.parse(memoryInstruction.match(/coveredOccurrenceIDs must be exactly (\[[^\n]+\])/u)?.[1] ?? "[]")
          : []
      const content =
        kind === "memory"
          ? JSON.stringify({
              baseRevision: 0,
              coveredOccurrenceIDs,
              disposition: "organized",
              markdown: "No durable memory.",
            })
          : "cross-process assistant reply"
      if (kind === "prompt") await promptGate.promise
      const id = `chatcmpl-global-chat-${requests.length}`
      const created = Math.floor(Date.now() / 1_000)
      const chunks = [
        {
          id,
          object: "chat.completion.chunk",
          created,
          model: "stream-model",
          choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
        },
        {
          id,
          object: "chat.completion.chunk",
          created,
          model: "stream-model",
          choices: [{ index: 0, delta: { content }, finish_reason: null }],
        },
        {
          id,
          object: "chat.completion.chunk",
          created,
          model: "stream-model",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        },
      ]
      return new Response(`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`, {
        headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "close" },
      })
    },
  })
  return {
    server,
    releasePrompts: promptGate.resolve,
    promptRequestCount: () => requests.filter((request) => request.kind === "prompt").length,
    apiURL: `http://127.0.0.1:${server.port}/v1`,
  }
}

describe("global Chat start cross-process convergence", () => {
  test("serializes concurrent starts and recovers both durable crash windows", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Global Chat process test requires the repository test runtime")
    const sharedRuntime = await createManagedTemporaryDirectory(processRoot, "global-chat-process-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "global-chat-process-barrier-")
    const provider = startStreamingProvider()
    const worker = path.join(import.meta.dir, "fixture", "global-chat-start-process-worker.ts")
    const environment = {
      ...process.env,
      OPENCORVUS_HOME: sharedRuntime,
      OPENCORVUS_TEST_PROCESS_ROOT: processRoot,
    }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: string, requestID: string, label?: string, text?: string) => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
          worker,
          mode,
          barrier,
          requestID,
          provider.apiURL,
          ...(label ? [label] : []),
          ...(text ? [text] : []),
        ],
        {
          cwd: path.join(import.meta.dir, ".."),
          env: environment,
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect(exitCode, stderr).toBe(0)
      const line = stdout
        .trim()
        .split(/\r?\n/)
        .findLast((candidate) => candidate.startsWith("{"))
      if (!line) throw new Error(`Global Chat worker returned no JSON: ${stderr || stdout}`)
      return JSON.parse(line) as Record<string, unknown>
    }
    const cut = async (mode: "cut-session" | "cut-message", requestID: string, exitCode: number) => {
      const child = spawn(mode, requestID)
      const [stderr, actualExit] = await Promise.all([new Response(child.stderr).text(), child.exited])
      expect(actualExit, stderr).toBe(exitCode)
    }
    const waitForRace = async (requestID: string) => {
      const deadline = Date.now() + 30_000
      while (
        (await fs.readdir(barrier)).filter((entry) => entry.startsWith(`${requestID}-`) && entry.endsWith(".ready"))
          .length < 2
      ) {
        if (Date.now() >= deadline) throw new Error("Global Chat race workers did not reach the barrier")
        await Bun.sleep(5)
      }
    }
    const waitForAccepted = async (requestID: string, count: number) => {
      const deadline = Date.now() + 30_000
      while (
        (await fs.readdir(barrier)).filter((entry) => entry.startsWith(`${requestID}-`) && entry.endsWith(".accepted"))
          .length < count
      ) {
        if (Date.now() >= deadline) throw new Error(`Global Chat ${requestID} workers were not both accepted`)
        await Bun.sleep(5)
      }
    }

    try {
      expect(await read(spawn("init", "initialization"))).toEqual({ initialized: true })

      const raceID = "global-chat-cross-process-race"
      const first = spawn("race", raceID, "first")
      const second = spawn("race", raceID, "second")
      await waitForRace(raceID)
      await fs.writeFile(path.join(barrier, `${raceID}.go`), "go")
      await waitForAccepted(raceID, 2)
      provider.releasePrompts()
      const raced = await Promise.all([read(first), read(second)])
      expect(raced).toEqual([
        expect.objectContaining({ status: 202, sessionID: expect.any(String), messageID: expect.any(String) }),
        expect.objectContaining({ status: 202, sessionID: expect.any(String), messageID: expect.any(String) }),
      ])
      expect(raced[0]!.sessionID).toBe(raced[1]!.sessionID)
      expect(raced[0]!.messageID).toBe(raced[1]!.messageID)
      expect(await read(spawn("inspect", raceID))).toEqual({
        sessionID: raced[0]!.sessionID,
        messageID: raced[0]!.messageID,
        userCount: 1,
        assistantCount: 1,
        assistantTexts: ["cross-process assistant reply"],
        assistantStates: [{ id: expect.any(String), finish: "stop" }],
        anonymousProjectCount: 1,
      })
      expect(provider.promptRequestCount()).toBe(1)

      const conflictRaceID = "global-chat-cross-process-payload-conflict"
      const original = spawn("race", conflictRaceID, "original", "Original cross-process payload")
      const changed = spawn("race", conflictRaceID, "changed", "Changed cross-process payload")
      await waitForRace(conflictRaceID)
      await fs.writeFile(path.join(barrier, `${conflictRaceID}.go`), "go")
      const conflictRace = await Promise.all([read(original), read(changed)])
      expect(conflictRace.map((result) => result.status).sort()).toEqual([202, 409])
      expect(conflictRace.find((result) => result.status === 409)).toMatchObject({
        error: { name: "GlobalChatStartIdentityConflictError" },
      })
      expect(await read(spawn("inspect", conflictRaceID))).toMatchObject({
        userCount: 1,
        assistantCount: 1,
        anonymousProjectCount: 2,
      })
      expect(provider.promptRequestCount()).toBe(2)

      for (const [mode, requestID, exitCode] of [
        ["cut-session", "global-chat-session-cut", 86],
        ["cut-message", "global-chat-message-cut", 87],
      ] as const) {
        await cut(mode, requestID, exitCode)
        const recovered = await read(spawn("recover", requestID))
        expect(recovered).toMatchObject({ status: 202 })
        expect(await read(spawn("inspect", requestID))).toMatchObject({
          sessionID: recovered.sessionID,
          messageID: recovered.messageID,
          userCount: 1,
          assistantCount: 1,
          assistantTexts: ["cross-process assistant reply"],
        })
      }
    } finally {
      for (const child of children) {
        if (child.exitCode === null) child.kill()
      }
      await Promise.allSettled(children.map((child) => child.exited))
      await removeManagedDirectoryTree(sharedRuntime)
      await removeManagedDirectoryTree(barrier)
      provider.server.stop(true)
    }
  }, 120_000)
})
