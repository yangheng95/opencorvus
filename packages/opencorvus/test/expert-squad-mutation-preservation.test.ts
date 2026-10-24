import { test } from "bun:test"
import assert from "node:assert/strict"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  DurablePublicationStore,
  digestFilesystemTree,
  setDurablePublicationTestCutHook,
} from "@opencorvus-ai/util/durable-publication"
import { preserveExpertSquadMutationEvidence as preserve } from "../src/expert-squad/mutation-preservation"
import { tmpdir } from "./fixture/fixture"

// These are local filesystem/Store contracts. Separate real Manager probes
// exercise process death, cold recovery and concurrent publishers.
async function fixture(root: string) {
  const configRoot = path.join(root, "config"),
    id = "preservation-contract",
    operationID = "original-operation"
  const journal = {
    operationID,
    id,
    target: path.join(root, "target"),
    backup: path.join(root, "backup"),
    staging: path.join(root, "staging"),
    discard: path.join(root, "discard"),
    installationScope: "global",
    databaseAuthority: "fixture-authority",
  }
  for (const key of ["target", "backup"] as const) {
    await mkdir(journal[key], { recursive: true })
    await writeFile(path.join(journal[key], "original.bin"), Buffer.from(key === "target" ? [0, 2, 255] : [0, 1, 255]))
  }
  const journalText = JSON.stringify(journal),
    journalPath = path.join(root, "journal.json")
  await writeFile(journalPath, journalText)
  const store = new DurablePublicationStore(path.join(configRoot, "durable-publications", "expert-squad-mutations", id))
  return {
    configRoot,
    id,
    journal,
    journalText,
    journalPath,
    databaseAuthority: journal.databaseAuthority,
    store,
    occurrence: () => store.read("preservation", operationID),
  }
}

test("legacy pending preserves its immutable facts and accurately archives a newly observed target", async () => {
  await using directory = await tmpdir()
  const input = await fixture(directory.path)
  const observations = {
    target: { kind: "present", treeDigest: await digestFilesystemTree(input.journal.target) },
    backup: { kind: "present", treeDigest: await digestFilesystemTree(input.journal.backup) },
    staging: { kind: "absent" },
    discard: { kind: "absent" },
  }
  await input.store.create({
    occurrenceID: input.journal.operationID,
    kind: "preservation",
    subject: input.id,
    timeCreated: 1,
    payload: {
      protocol: "opencorvus/expert-squad-mutation-preservation@1",
      disposition: "commit_receipt_unavailable",
      journal: input.journal,
      journalText: input.journalText,
      journalPath: input.journalPath,
      databaseAuthority: input.databaseAuthority,
      reason: "receipt_absent",
      observations,
    },
  })
  const archive = input.store.occurrenceDirectory("preservation", input.journal.operationID)
  const resources = path.join(archive, "resources")
  await mkdir(resources)
  await writeFile(path.join(resources, "original-journal.json"), input.journalText)
  await input.store.appendPhase("preservation", {
    occurrenceID: input.journal.operationID,
    sequence: 1,
    name: "retained-journal",
    timeCreated: 2,
    payload: { resource: path.join(resources, "original-journal.json"), observation: { kind: "original_bytes" } },
  })
  const intent = await readFile(path.join(archive, "intent.json")),
    phase = await readFile(path.join(archive, "phases", "000001-retained-journal.json"))
  await writeFile(path.join(input.journal.target, "original.bin"), Buffer.from([0, 3, 255]))
  const outcome = await preserve(input)
  const complete = await input.occurrence(),
    evidence = complete.terminal!.payload.resourceEvidence as any
  assert.equal(outcome.disposition, "commit_receipt_unavailable")
  assert.deepEqual(await readFile(path.join(archive, "intent.json")), intent)
  assert.deepEqual(await readFile(path.join(archive, "phases", "000001-retained-journal.json")), phase)
  assert.equal(evidence.target.expectedObservationAvailable, false)
  assert.equal(evidence.target.preserved[0].resource, path.join(resources, "target-observed"))
  assert.deepEqual(await readFile(evidence.target.preserved[0].resource + "/original.bin"), Buffer.from([0, 3, 255]))
  assert.deepEqual(await readFile(path.join(input.journal.target, "original.bin")), Buffer.from([0, 3, 255]))
  assert.deepEqual(complete.phases.filter((item) => item.name === "upgrade-v2").length, 1)
  assert.deepEqual(await preserve(input), outcome)
})

test("an exact copied target survives a changed source and records a distinct observation after the original plan", async () => {
  await using directory = await tmpdir()
  const input = await fixture(directory.path)
  const interruption = new Error("local after-copy cut")
  setDurablePublicationTestCutHook(async (cut, kind) => {
    if (kind !== "preservation" || cut !== "phase-temp-synced") return
    const value = await input.occurrence()
    if (value.phases.at(-1)?.name === "retained-journal") throw interruption
  })
  try {
    await assert.rejects(preserve(input), (error) => error === interruption)
  } finally {
    setDurablePublicationTestCutHook()
  }
  const before = await input.occurrence()
  const plan = await readFile(path.join(before.directory, "phases", "000001-resource-plan-v2.json"))
  await writeFile(path.join(input.journal.target, "original.bin"), Buffer.from([0, 3, 255]))
  await preserve(input)
  const complete = await input.occurrence(),
    evidence = complete.terminal!.payload.resourceEvidence as any
  assert.deepEqual(await readFile(path.join(before.directory, "phases", "000001-resource-plan-v2.json")), plan)
  assert.equal(complete.phases.filter((item) => item.name === "resource-observation-v2").length, 1)
  assert.equal(evidence.target.expectedObservationAvailable, true)
  const original = evidence.target.preserved.find((asset: any) => asset.classification === "expected")
  const observed = evidence.target.preserved.find((asset: any) => asset.classification === "observed_source")
  assert.deepEqual(await readFile(path.join(original.resource, "original.bin")), Buffer.from([0, 2, 255]))
  assert.deepEqual(await readFile(path.join(observed.resource, "original.bin")), Buffer.from([0, 3, 255]))
  const terminal = await readFile(path.join(complete.directory, "terminal.json"))
  await preserve(input)
  assert.deepEqual(await readFile(path.join(complete.directory, "terminal.json")), terminal)
})

test("a backup lost after its frozen plan remains explicit missing evidence while current bytes reach a terminal", async () => {
  await using directory = await tmpdir()
  const input = await fixture(directory.path)
  const interruption = new Error("local after-plan cut")
  setDurablePublicationTestCutHook((cut, kind) => {
    if (kind === "preservation" && cut === "phase-published") throw interruption
  })
  try {
    await assert.rejects(preserve(input), (error) => error === interruption)
  } finally {
    setDurablePublicationTestCutHook()
  }
  const before = await input.occurrence()
  const plan = await readFile(path.join(before.directory, "phases", "000001-resource-plan-v2.json"))
  await rm(input.journal.backup, { recursive: true })
  await preserve(input)
  const complete = await input.occurrence(),
    evidence = complete.terminal!.payload.resourceEvidence as any
  assert.equal(evidence.backup.expectedObservationAvailable, false)
  assert.equal(evidence.backup.missing[0].classification, "expected")
  assert.equal(evidence.target.expectedObservationAvailable, true)
  assert.equal(complete.terminal!.payload.disposition, "commit_receipt_unavailable")
  assert.deepEqual(await readFile(path.join(before.directory, "phases", "000001-resource-plan-v2.json")), plan)
  await preserve(input)
  assert.deepEqual(await input.occurrence(), complete)
})
