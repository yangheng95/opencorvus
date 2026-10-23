import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import marketing from "@squads/marketing-growth/tools/publish-marketing-growth-artifact"
import seo from "@squads/seo-geo/tools/publish-seo-geo-artifact"

const payload = (stage: string) => ({
  stage,
  scope: "Local predecessor contract",
  as_of: "2026-10-24",
  evidence: [],
  findings: [],
  decisions: [],
  unknowns: [],
  resource_roles: [],
})

for (const [id, publisher, rootType, nextType, planner, researcher] of [
  [
    "marketing-growth",
    marketing,
    "growth-brief",
    "evidence-dossier",
    "marketing-growth-planner",
    "marketing-growth-evidence-researcher",
  ],
  ["seo-geo", seo, "discovery-brief", "source-dossier", "seo-geo-planner", "seo-geo-source-researcher"],
] as const) {
  const fixture = (version: number, sourcePayload: unknown) => {
    const envelope = {
      artifact_type: `${id}/${rootType}`,
      schema_version: version,
      producer: {
        owner_kind: "projected-worker",
        expert_squad_id: id,
        agent_id: planner,
        package_revision: {
          scope: "built_in",
          project_id: null,
          namespace: "builtin",
          id,
          version: "2026.10.24.1",
          package_digest: "a".repeat(64),
        },
        projection_hash: "b".repeat(64),
        session_id: "ses_source",
        message_id: "msg_source",
        tool_call_id: "call_source",
      },
      payload: sourcePayload,
      resources: [],
      observed_artifact_locators: [],
      source_artifact_locators: [],
    }
    const bytes = Buffer.from(JSON.stringify(envelope)),
      sha256 = createHash("sha256").update(bytes).digest("hex")
    const locator = {
      source: "engine_artifact" as const,
      artifact_id: "art_source",
      catalog_revision: 1,
      expected_sha256: sha256,
    }
    const selected: unknown[] = [],
      published: unknown[] = []
    const host = {
      engineArtifacts: {
        async read(input: { byte_offset: number; max_bytes: number }) {
          const end = Math.min(bytes.length, input.byte_offset + input.max_bytes)
          return {
            chunk: {
              locator,
              media_type: "application/json",
              sha256,
              byte_start: input.byte_offset,
              byte_end: end,
              total_bytes: bytes.length,
              next_offset: end === bytes.length ? null : end,
              complete: end === bytes.length,
              text: bytes.subarray(input.byte_offset, end).toString("utf8"),
              attachment: false,
            },
          }
        },
        async select(input: unknown) {
          selected.push(input)
        },
        async publish(input: unknown) {
          published.push(input)
          return { locator, sha256 }
        },
      },
      taskArtifacts: {},
    }
    const execute = () =>
      publisher.execute(
        {
          artifact: { artifact_type: `${id}/${nextType}`, payload: payload(`${id}/${nextType}`) },
          resource_set: null,
          predecessor_artifact_locators: [locator],
        } as never,
        { agent: researcher, host } as never,
      )
    return { execute, selected, published, locator }
  }

  test(`${id} accepts its exact version-one typed predecessor and selects it for publication`, async () => {
    const scenario = fixture(1, payload(`${id}/${rootType}`))
    expect(JSON.parse(await scenario.execute()).artifact_type).toBe(`${id}/${nextType}`)
    expect(scenario.selected).toEqual([expect.objectContaining({ locator: scenario.locator })])
    expect(scenario.published).toEqual([
      expect.objectContaining({ artifact_type: `${id}/${nextType}`, payload: payload(`${id}/${nextType}`) }),
    ])
  })

  test(`${id} reports the explicit predecessor schema-version contract`, async () => {
    await expect(fixture(2, payload(`${id}/${rootType}`)).execute()).rejects.toMatchObject({
      name: "ArtifactInspectionError",
      diagnostics: ["schema_version must be 1; received 2"],
    })
  })

  test(`${id} reports invalid typed predecessor payload fields`, async () => {
    await expect(fixture(1, {}).execute()).rejects.toMatchObject({ name: "ZodError" })
  })
}
