import { test, expect } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import { DurablePublicationStore } from "@opencorvus-ai/util/durable-publication"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

test("intent selection returns exact current facts from one Project namespace", async () => {
  const root = await fs.mkdtemp(path.join(Global.Path.temporary, "publication-intents-"))
  try {
    const store = new DurablePublicationStore(root)
    for (const [kind, id, resource] of [
      ["project-a", "a", "current"],
      ["project-a", "b", "historical"],
      ["project-b", "c", "current"],
    ])
      await store.create({ kind: kind!, occurrenceID: id!, subject: resource!, payload: { resource }, timeCreated: 1 })
    await store.appendPhase("project-a", {
      occurrenceID: "a",
      sequence: 1,
      name: "completed",
      payload: { output: "exact selected bytes" },
      timeCreated: 2,
    })
    await store.settle("project-a", {
      occurrenceID: "a",
      outcome: "committed",
      payload: { result: "published" },
      timeCreated: 3,
    })
    await fs.mkdir(path.join(store.occurrenceDirectory("project-a", "b"), "phases"))
    await fs.writeFile(
      path.join(store.occurrenceDirectory("project-a", "b"), "phases/0001.json"),
      "historical unmatched payload",
    )
    await fs.writeFile(
      path.join(store.occurrenceDirectory("project-b", "c"), "intent.json"),
      "other Project corrupt intent",
    )
    const selected = await store.list("project-a", (intent) => intent.payload.resource === "current")
    expect(
      selected.map((item) => ({
        id: item.intent.occurrenceID,
        phases: item.phases.map((phase) => phase.payload),
        terminal: item.terminal?.payload,
      })),
    ).toEqual([{ id: "a", phases: [{ output: "exact selected bytes" }], terminal: { result: "published" } }])
  } finally {
    await removeManagedDirectoryTree(root)
  }
})

test("a malformed intent maps to its parse error before intent filtering", async () => {
  const root = await fs.mkdtemp(path.join(Global.Path.temporary, "publication-intent-error-"))
  try {
    const store = new DurablePublicationStore(root)
    await store.create({ kind: "project-a", occurrenceID: "a", subject: "resource", payload: {}, timeCreated: 1 })
    await fs.writeFile(path.join(store.occurrenceDirectory("project-a", "a"), "intent.json"), "{")
    const error = await store.list("project-a", () => false).catch((error) => error)
    expect(error.name).toBe("SyntaxError")
  } finally {
    await removeManagedDirectoryTree(root)
  }
})
