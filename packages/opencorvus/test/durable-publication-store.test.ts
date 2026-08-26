import { afterEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { DurablePublicationStore } from "@opencorvus-ai/util/durable-publication"

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe("durable publication fact store", () => {
  test("reloads one immutable intent, ordered phases and terminal receipt", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-publication-"))
    roots.push(root)
    const store = new DurablePublicationStore(root)
    const occurrenceID = crypto.randomUUID()

    await store.create({
      occurrenceID,
      kind: "test-publication",
      subject: "catalog:test",
      payload: { target: "generation-a" },
      timeCreated: 1,
    })
    await store.appendPhase("test-publication", {
      occurrenceID,
      sequence: 1,
      name: "prepared",
      payload: { digest: "a".repeat(64) },
      timeCreated: 2,
    })
    await store.appendPhase("test-publication", {
      occurrenceID,
      sequence: 2,
      name: "published",
      payload: { generation: "generation-a" },
      timeCreated: 3,
    })
    await store.settle("test-publication", {
      occurrenceID,
      outcome: "committed",
      payload: { generation: "generation-a" },
      timeCreated: 4,
    })

    const reloaded = await new DurablePublicationStore(root).read("test-publication", occurrenceID)
    expect({
      subject: reloaded.intent.subject,
      phases: reloaded.phases.map((phase) => [phase.sequence, phase.name]),
      terminal: reloaded.terminal,
      open: await store.listOpen("test-publication"),
    }).toEqual({
      subject: "catalog:test",
      phases: [
        [1, "prepared"],
        [2, "published"],
      ],
      terminal: {
        schemaVersion: 1,
        occurrenceID,
        outcome: "committed",
        payload: { generation: "generation-a" },
        timeCreated: 4,
      },
      open: [],
    })
  })

  test("a killed writer leaves only a complete old or new intent, phase and terminal fact", async () => {
    const fixture = path.join(import.meta.dir, "fixture", "durable-publication-child.ts")
    const cases = [
      ["intent", "occurrence-staging-created", 0, false],
      ["intent", "intent-temp-synced", 0, false],
      ["intent", "occurrence-published", 0, false],
      ["phase", "phase-temp-synced", 0, false],
      ["phase", "phase-published", 1, false],
      ["terminal", "terminal-temp-synced", 1, false],
      ["terminal", "terminal-published", 1, true],
    ] as const

    for (const [action, cut, expectedPhases, expectedTerminal] of cases) {
      const root = await mkdtemp(path.join(os.tmpdir(), `opencorvus-publication-crash-${action}-`))
      roots.push(root)
      const child = Bun.spawn([process.execPath, fixture, root, action, cut], {
        cwd: path.join(import.meta.dir, ".."),
        stdout: "pipe",
        stderr: "pipe",
      })
      const exitCode = await child.exited
      expect(exitCode).not.toBe(0)

      const store = new DurablePublicationStore(root)
      const listed = await store.list("test-publication")
      if (action === "intent" && expectedPhases === 0 && !expectedTerminal) {
        expect(listed.length).toBe(cut === "occurrence-published" ? 1 : 0)
        if (listed.length === 0) continue
      }
      const occurrence = await store.read("test-publication", "occurrence-crash-proof")
      expect({ phases: occurrence.phases.length, terminal: Boolean(occurrence.terminal) }).toEqual({
        phases: expectedPhases,
        terminal: expectedTerminal,
      })
    }
  }, 60_000)
})
