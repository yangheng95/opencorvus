import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readEngineArtifactEnvelope } from "@squads/evolution-lab/lib/evolution-lab/engine-evidence"
import { readEvolutionMetricContext } from "@squads/evolution-lab/lib/evolution-lab/metric-context"
import rehydrate from "@squads/evolution-lab/tools/rehydrate-evolution-resources"

const producer = (agent: string) => ({
  owner_kind: "projected-worker",
  expert_squad_id: "evolution-lab",
  agent_id: agent,
  package_revision: {
    scope: "project",
    project_id: "project-source",
    namespace: "builtin",
    id: "evolution-lab",
    version: "2026.10.24.1",
    package_digest: "a".repeat(64),
  },
  projection_hash: "b".repeat(64),
  session_id: "session-source",
  message_id: "message-source",
  tool_call_id: "call-source",
})
function transport(
  type: string,
  options: { agent?: string; version?: number; payload?: unknown; imported?: boolean } = {},
) {
  const original = producer(options.agent ?? "evolution-observer")
  const envelope = {
    artifact_type: type,
    schema_version: options.version ?? 1,
    payload: options.payload ?? {},
    resources: [],
    producer: options.imported
      ? {
          owner_kind: "mission",
          mission_id: "mission-import",
          session_id: "session-import",
          message_id: "message-import",
          tool_call_id: "call-import",
        }
      : original,
    observed_artifact_locators: [],
    source_artifact_locators: [],
    ...(options.imported
      ? {
          import_lineage: {
            source_task_id: "task-source",
            source_kind: "expert_output",
            source_producer: original,
            source_locator: {
              source: "engine_artifact",
              artifact_id: "artifact-source",
              catalog_revision: 1,
              expected_sha256: "c".repeat(64),
            },
            source_provenance: { observed_artifact_locators: [], source_artifact_locators: [] },
          },
        }
      : {}),
  }
  const bytes = Buffer.from(JSON.stringify(envelope)),
    sha256 = createHash("sha256").update(bytes).digest("hex")
  const locator = {
    source: "engine_artifact" as const,
    artifact_id: "artifact-current",
    catalog_revision: 1,
    expected_sha256: sha256,
  }
  const selections: unknown[] = []
  const context = {
    host: {
      engineArtifacts: {
        async read({ byte_offset: start, max_bytes: max }: { byte_offset: number; max_bytes: number }) {
          const end = Math.min(start + max, bytes.length)
          return {
            chunk: {
              locator,
              media_type: "application/json",
              sha256,
              byte_start: start,
              byte_end: end,
              total_bytes: bytes.length,
              complete: end === bytes.length,
              next_offset: end === bytes.length ? null : end,
              text: bytes.subarray(start, end).toString("utf8"),
              attachment: false,
            },
          }
        },
        async select(input: unknown) {
          selections.push(input)
        },
      },
    },
  } as never
  return { context, locator, selections, envelope }
}
for (const [type, owner] of [
  ["campaign-spec", "evolution-experiment-planner"],
  ["run-evidence-bundle", "evolution-evaluator"],
  ["candidate-revision", "evolution-candidate-author"],
]) {
  test(`shared reader reports the exact ${type} producer contract`, async () => {
    const source = transport("evolution-lab/" + type, { agent: "evolution-observer" })
    await expect(readEngineArtifactEnvelope(source.locator, source.context)).rejects.toMatchObject({
      name: "EvolutionArtifactIntegrityError",
      message: `evolution-lab/${type} must be produced by Evolution Lab worker ${owner}`,
    })
  })
}
test("metric execution reports a Campaign from the wrong producer", async () => {
  const source = transport("evolution-lab/campaign-spec")
  await expect(
    readEvolutionMetricContext(
      { campaign_spec_locator: source.locator, run_evidence_locator: source.locator, candidate_revision_locator: null },
      source.context,
    ),
  ).rejects.toMatchObject({
    name: "EvolutionArtifactIntegrityError",
    message: "evolution-lab/campaign-spec must be produced by Evolution Lab worker evolution-experiment-planner",
  })
})
for (const role of ["campaign_inputs", "candidate_package"] as const) {
  test(`resource rehydration enforces ABI 1 for ${role}`, async () => {
    const source = transport("evolution-lab/" + (role === "campaign_inputs" ? "campaign-spec" : "candidate-revision"), {
      version: 2,
    })
    await expect(
      rehydrate.execute({ artifact_locator: source.locator, resource_role: role }, source.context),
    ).rejects.toMatchObject({ name: "ArtifactInspectionError", diagnostics: ["schema_version must be 1; received 2"] })
  })
  test(`resource rehydration enforces the typed producer for ${role}`, async () => {
    const type = role === "campaign_inputs" ? "campaign-spec" : "candidate-revision",
      owner = role === "campaign_inputs" ? "evolution-experiment-planner" : "evolution-candidate-author"
    const source = transport("evolution-lab/" + type)
    await expect(
      rehydrate.execute({ artifact_locator: source.locator, resource_role: role }, source.context),
    ).rejects.toMatchObject({
      name: "EvolutionArtifactIntegrityError",
      message: `evolution-lab/${type} must be produced by Evolution Lab worker ${owner}`,
    })
  })
}
test("shared exact reader validates and selects an imported opportunity using its original worker", async () => {
  const payload = {
    target: { scope: "built_in", project_id: null, project_directory: null, namespace: "builtin", id: "review-debug" },
    current_revision: {
      namespace: "builtin",
      id: "review-debug",
      version: "2026.10.14.1",
      package_digest: "d".repeat(64),
    },
    trigger: { type: "user", identity: "message-user" },
    evidence: [],
    observable_symptom: "Exact observed decimal truncation",
    impact_scope: "One selected invoice export",
    frequency: "one observed run",
    data_window: { started_at: "2026-10-24T00:00:00Z", ended_at: "2026-10-24T00:01:00Z" },
    owner_hypothesis: "Selected implementation",
    unknowns: ["Other inputs"],
    sensitivity: "internal",
    suggested_budget: { runs: 2, max_cost: null },
  }
  const source = transport("evolution-lab/opportunity", { imported: true, payload })
  expect((await readEngineArtifactEnvelope(source.locator, source.context)).payload).toEqual(payload)
  expect(source.selections).toEqual([{ locator: source.locator, purpose: "Exact Evolution Artifact predecessor" }])
})
