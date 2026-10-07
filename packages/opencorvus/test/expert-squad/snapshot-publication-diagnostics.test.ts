import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { ExpertSquadRegistry as Registry } from "@/expert-squad/registry"
import { Log } from "@/util/log"
import { SkillReadDiagnostics } from "@/skill/read-diagnostics"

const evidence = path.resolve(
  import.meta.dir,
  "../../../../specs/artifacts/2026-10-05-connection-workspace-authority/skills-load-timeout-98/publication-trace",
)

test("real source and embedded publication retain package outputs and truthful diagnostic phases", async () => {
  const owner = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!owner) throw new Error("Canonical isolated test runtime is required")
  const root = await createManagedTemporaryDirectory(path.join(owner, "fixtures"), "snapshot-trace-")
  const definition: ExpertSquadPackageDefinition = {
    manifest: {
      schema_version: 2,
      namespace: "trace",
      id: "publication",
      label: "Publication trace",
      version: "2026.10.07.1",
      description: "Owned publication contract",
      product_pillars: ["code"],
      readme: "README.md",
      selector: { summary: "Publication", selection_guidance: "Use real bytes", instructions: "selector.md" },
      capability_sets: {},
      capability_projection: {
        scheduler: { base_role: "orchestrator", capability_refs: [] },
        agents: {},
        virtual_workflows: {},
      },
    },
    files: { "README.md": "# Publication trace\nReal immutable output.\n", "selector.md": "# Select publication\n" },
  }
  await Log.init({ print: false, dev: true, level: "DEBUG" })
  try {
    const sources = [
      path.join(root, "project-a", "trace", "publication"),
      path.join(root, "project-b", "trace", "publication"),
    ]
    await Promise.all(sources.map((directory) => writeExpertSquadPackage({ directory, definition })))
    const settled = await Promise.allSettled(sources.map((directory) => Registry.loadPackage(directory)))
    const results = settled.map((result) => {
      if (result.status === "rejected") throw result.reason
      return result.value
    })
    const warm = await Registry.loadPackage(sources[0]!)
    const embeddedFiles: Registry.EmbeddedPackageSource["files"] = {}
    for (const entry of await fs.readdir(sources[0]!)) {
      embeddedFiles[entry] = await fs.readFile(path.join(sources[0]!, entry), "utf8")
    }
    const embedded = await Registry.materializeEmbeddedPackageSnapshot({
      namespace: "trace",
      id: "publication",
      files: embeddedFiles,
    })
    const embeddedLoaded = await Registry.loadPackageRevisionSnapshot(embedded.digest)
    const changedReadme = "# Publication trace\nNew revision has different actual bytes.\n"
    const changedSource = path.join(root, "project-c", "trace", "publication")
    await writeExpertSquadPackage({
      directory: changedSource,
      definition: { ...definition, files: { ...definition.files, "README.md": changedReadme } },
    })
    const changed = await Registry.loadPackage(changedSource)
    const pinnedOld = await Registry.loadPackageRevisionSnapshot(warm.packageDigest)
    const revisionOutputs = await Promise.all(
      [changed, pinnedOld].map(async (value) => ({
        id: value.id,
        namespace: value.namespace,
        version: value.version,
        readme: await fs.readFile(value.readmePath, "utf8"),
      })),
    )
    const outputs = await Promise.all(
      [...results, warm, embeddedLoaded].map(async (value) => ({
        id: value.id,
        namespace: value.namespace,
        version: value.version,
        readme: await fs.readFile(value.readmePath, "utf8"),
        scheduler: value.manifest.capability_projection.scheduler,
        packageDigest: value.packageDigest,
      })),
    )
    await Log.flush()
    const raw = await fs.readFile(Log.file(), "utf8")
    const parsed = raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    const diagnostics = parsed.filter((row) => row.service === "skill-read-diagnostics")
    await fs.mkdir(evidence, { recursive: true })
    const capture = path.join(evidence, `checker-${crypto.randomUUID()}`)
    await fs.writeFile(`${capture}.log`, raw)
    await fs.writeFile(
      `${capture}.json`,
      JSON.stringify(
        {
          outputs,
          revisionOutputs,
          diagnostics,
          native: { platform: process.platform, node: process.versions.node },
          settled: settled.map((value) => value.status),
        },
        null,
        2,
      ),
    )
    console.log(`Publication evidence: ${capture}`)
    expect(
      outputs.map(({ id, namespace, version, readme, scheduler }) => ({ id, namespace, version, readme, scheduler })),
    ).toEqual(
      Array.from({ length: 4 }, () => ({
        id: "publication",
        namespace: "trace",
        version: "2026.10.07.1",
        readme: "# Publication trace\nReal immutable output.\n",
        scheduler: definition.manifest.capability_projection.scheduler,
      })),
    )
    const completed = diagnostics.filter((row) => row.data.status === "completed")
    expect(revisionOutputs).toEqual([
      { id: "publication", namespace: "trace", version: "2026.10.07.1", readme: changedReadme },
      {
        id: "publication",
        namespace: "trace",
        version: "2026.10.07.1",
        readme: "# Publication trace\nReal immutable output.\n",
      },
    ])
    for (const phase of [
      "projection.package-source-capture",
      "projection.package-publication",
      "projection.package-existing-verify",
      "projection.package-staging-write",
      "projection.package-atomic-publication",
      "projection.package-final-verify",
    ]) {
      expect(
        completed
          .filter((row) => row.data.phase === phase)
          .map((row) => ({ outcome: row.data.outcome, durationType: typeof row.data.duration })),
      ).toContainEqual({ outcome: "fulfilled", durationType: "number" })
    }
  } finally {
    await Log.flush()
    await removeManagedDirectoryTree(root)
  }
}, 120_000)

test("snapshot observation returns the original promise and rejection object", async () => {
  const value = { accepted: "original" }
  const promise = Promise.resolve(value)
  const metadata = { digest: "owned-observation-identity", fileCount: 3, stagingBasename: ".snapshot-owned" }
  await Log.init({ print: false, dev: true, level: "INFO" })
  expect(SkillReadDiagnostics.phase("projection.package-publication", () => promise, metadata)).toBe(promise)
  await Log.init({ print: false, dev: true, level: "DEBUG" })
  const requestID = crypto.randomUUID()
  expect(
    SkillReadDiagnostics.request(requestID, () =>
      SkillReadDiagnostics.phase("projection.package-publication", () => promise, metadata),
    ),
  ).toBe(promise)
  expect(await promise).toBe(value)
  const error = new Error("Owned diagnostic rejection")
  const rejected = Promise.reject(error)
  expect(SkillReadDiagnostics.phase("projection.package-source-capture", () => rejected, metadata)).toBe(rejected)
  await expect(rejected).rejects.toBe(error)
  await Log.flush()
  const raw = await fs.readFile(Log.file(), "utf8")
  const rows = raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const row = rows.find(
    (entry) =>
      entry.service === "skill-read-diagnostics" &&
      entry.data.phase === "projection.package-publication" &&
      entry.data.http.requestID === requestID &&
      entry.data.status === "completed",
  )
  expect(row.data).toMatchObject({
    ...metadata,
    parentSpanID: expect.any(String),
    http: { requestID },
    outcome: "fulfilled",
  })
})

test("actual missing source capture reports its original package boundary error", async () => {
  const owner = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!owner) throw new Error("Canonical isolated test runtime is required")
  await Log.init({ print: false, dev: true, level: "DEBUG" })
  let original: unknown
  try {
    await Registry.loadPackage(path.join(owner, "fixtures", `missing-${crypto.randomUUID()}`))
  } catch (error) {
    original = error
  }
  expect(original).toMatchObject({ name: "Error", message: "expert squad package root: expected directory" })
  await Log.flush()
  const raw = await fs.readFile(Log.file(), "utf8")
  const rows = raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
  const capture = path.join(evidence, `rejected-${crypto.randomUUID()}`)
  await fs.writeFile(`${capture}.log`, raw)
  expect(
    rows
      .filter(
        (row) =>
          row.service === "skill-read-diagnostics" &&
          row.data.phase === "projection.package-source-capture" &&
          row.data.status === "completed",
      )
      .map((row) => ({ outcome: row.data.outcome, errorType: row.data.errorType })),
  ).toContainEqual({ outcome: "rejected", errorType: "error" })
})
