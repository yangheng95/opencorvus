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
})
