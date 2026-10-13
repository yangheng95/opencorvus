import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Truncate } from "@/tool/truncation"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { Database } from "@/storage/db"
import { PermissionExecutionResultTable } from "@/permission/permission.sql"
import { durableExecutionResult } from "@/permission/execution-result"
import { CompactionEvidenceReader } from "@/session/compaction-evidence-reader"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

test("retention settles expired outputs in both current runtime ownership roots", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const taskOutput = path.join(
        ProjectRuntimePaths.toolOutputDir(project.path, Identifier.ascending("task"), Identifier.ascending("session")),
        Identifier.ascending("tool"),
      )
      const conversationOutput = path.join(
        ProjectRuntimePaths.rootSessionToolOutputDir(project.path, Identifier.ascending("session")),
        Identifier.ascending("tool"),
      )
      for (const output of [taskOutput, conversationOutput]) {
        await fs.mkdir(path.dirname(output), { recursive: true })
        await fs.writeFile(output, "expired tool output")
        const expired = new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000)
        await fs.utimes(output, expired, expired)
      }

      const receipt = await Truncate.cleanup()

      expect(receipt.scanned).toBeGreaterThanOrEqual(2)
      expect(receipt.removed).toEqual(expect.arrayContaining([taskOutput, conversationOutput]))
    },
  })
})

test.each(["conversation", "task"] as const)(
  "retains referenced %s evidence across age cleanup and reopen",
  async (layout) => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Long-lived exact evidence" })
        const source = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "chat",
          model: { providerID: "local", modelID: "retention" },
          time: { created: Date.now() },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: source.id,
          role: "assistant",
          author: "chat",
          agent: "chat",
          modelID: "retention",
          providerID: "local",
          time: { created: Date.now() },
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        })
        const directory =
          layout === "task"
            ? ProjectRuntimePaths.toolOutputDir(project.path, Identifier.ascending("task"), session.id)
            : ProjectRuntimePaths.rootSessionToolOutputDir(project.path, session.id)
        await fs.mkdir(directory, { recursive: true })
        const full = "Original evidence 中文😀; TRACE=retained; next_offset=317.\n".repeat(1400)
        const outputPath = path.join(directory, Identifier.ascending("tool"))
        await fs.writeFile(outputPath, full)
        const partID = Identifier.ascending("part")
        await Session.updatePart({
          id: partID,
          messageID: assistant.id,
          sessionID: session.id,
          type: "tool",
          tool: "read",
          callID: `call_${layout}`,
          state: {
            status: "completed",
            input: { path: "original-source" },
            title: "Evidence",
            output: "Short preview",
            metadata: {
              outputPath: process.platform === "win32" ? outputPath.toUpperCase().replaceAll("\\", "/") : outputPath,
              truncated: true,
            },
            time: { start: 1, end: 2 },
          },
        })
        await Session.updateMessage({
          ...assistant,
          finish: "stop",
          time: { ...assistant.time, completed: Date.now() },
        })
        const fork = await Session.fork({ sessionID: session.id })
        const expired = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
        await fs.utimes(outputPath, expired, expired)
        Database.close()
        const receipt = await Truncate.cleanup()
        const retained = await fs.readFile(outputPath, "utf8")
        expect(retained).toBe(full)
        expect(receipt.retained).toContain(outputPath)
        for (const sessionID of [session.id, fork.id]) {
          const messages = await Session.messages({ sessionID })
          const part = messages.flatMap((message) => message.parts).find((part) => part.type === "tool")
          if (!part || part.type !== "tool" || part.state.status !== "completed")
            throw new Error("Canonical retained Tool required")
          expect(
            await CompactionEvidenceReader.authoritativeOutput(part as CompactionEvidenceReader.CompletedToolPart),
          ).toEqual({ source: "truncation-file", output: full })
        }
      },
    })
  },
)

test("retains recovery-receipt and live-progress evidence before a terminal Tool outcome", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "In-flight source retention" })
      const directory = ProjectRuntimePaths.rootSessionToolOutputDir(project.path, session.id)
      await fs.mkdir(directory, { recursive: true })
      const receiptPath = path.join(directory, Identifier.ascending("tool"))
      const progressPath = path.join(directory, Identifier.ascending("tool"))
      const requestPath = path.join(directory, Identifier.ascending("tool"))
      const expired = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      for (const file of [receiptPath, progressPath, requestPath]) {
        await fs.writeFile(file, `Exact recoverable output for ${path.basename(file)}`)
        await fs.utimes(file, expired, expired)
      }
      Database.immediateTransaction((db) =>
        db
          .insert(PermissionExecutionResultTable)
          .values({
            attempt_id: Identifier.ascending("permission"),
            result: durableExecutionResult({
              output: "Preview",
              title: "Recovered result",
              metadata: { truncated: true, outputPath: receiptPath },
            }).payload,
            time_created: Date.now(),
          })
          .run(),
      )
      const source = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "user",
        author: "user",
        agent: "chat",
        model: { providerID: "local", modelID: "retention" },
        time: { created: Date.now() },
      })
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: session.id,
        parentID: source.id,
        role: "assistant",
        author: "chat",
        agent: "chat",
        modelID: "retention",
        providerID: "local",
        time: { created: Date.now() },
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      })
      const part = await Session.updatePart({
        id: Identifier.ascending("part"),
        messageID: assistant.id,
        sessionID: session.id,
        type: "tool",
        tool: "read",
        callID: "retained-progress",
        metadata: { outputPath: requestPath },
        state: { status: "running", input: {}, time: { start: 1 } },
      })
      await Session.appendToolProgress({
        sessionID: session.id,
        messageID: assistant.id,
        partID: part.id,
        metadata: { outputPath: progressPath },
      })
      Database.close()
      const receipt = await Truncate.cleanup()
      expect(receipt.retained).toEqual(expect.arrayContaining([receiptPath, progressPath, requestPath]))
      for (const file of [receiptPath, progressPath, requestPath])
        expect(await fs.readFile(file, "utf8")).toBe(`Exact recoverable output for ${path.basename(file)}`)
      expect(
        (await MessageStore.get({ sessionID: session.id, messageID: assistant.id })).parts.find(
          (candidate) => candidate.id === part.id,
        ),
      ).toMatchObject({
        metadata: { outputPath: requestPath },
        state: { status: "running", metadata: { outputPath: progressPath } },
      })
    },
  })
})

test("observes references committed after cleanup starts while reclaiming aged orphan batches", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Concurrent retention publication" })
      const directory = ProjectRuntimePaths.rootSessionToolOutputDir(project.path, session.id)
      await fs.mkdir(directory, { recursive: true })
      const orphanPaths = Array.from({ length: 192 }, () => path.join(directory, Identifier.ascending("tool")))
      const referencedPath = path.join(directory, Identifier.ascending("tool"))
      const expired = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      for (const file of [...orphanPaths, referencedPath]) {
        await fs.writeFile(file, "Exact source survives late reference publication: 证明😀")
        await fs.utimes(file, expired, expired)
      }
      const started = performance.now()
      const cleaning = Truncate.cleanup()
      // cleanup has read its initial retain-only snapshot and yielded to its
      // real filesystem scan. This commit must be seen by the deletion check.
      Database.immediateTransaction((db) =>
        db
          .insert(PermissionExecutionResultTable)
          .values({
            attempt_id: Identifier.ascending("permission"),
            result: durableExecutionResult({
              output: "Preview",
              title: "Late recovery source",
              metadata: { truncated: true, outputPath: referencedPath },
            }).payload,
            time_created: Date.now(),
          })
          .run(),
      )
      const receipt = await cleaning
      expect(receipt.removed).toEqual(expect.arrayContaining(orphanPaths))
      expect(receipt.removed).toHaveLength(orphanPaths.length)
      expect(receipt.retained).toContain(referencedPath)
      expect(await fs.readFile(referencedPath, "utf8")).toBe("Exact source survives late reference publication: 证明😀")
      console.log(
        JSON.stringify({
          contract: "retention-fresh-reference",
          scanned: receipt.scanned,
          removed: receipt.removed.length,
          retained: receipt.retained.length,
          elapsedMs: Math.round(performance.now() - started),
        }),
      )
    },
  })
})
