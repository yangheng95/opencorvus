import { expect, test } from "bun:test"
import Ajv from "ajv/dist/2020"
import data from "@squads/data-analysis/tools/publish-data-analysis-artifact"
import viral from "@squads/viral-content/tools/publish-viral-content-artifact"
import legal from "@squads/commercial-legal/tools/publish-commercial-legal-artifact"
import hr from "@squads/hr-operations/tools/publish-hr-operations-artifact"
import tax from "@squads/tax-compliance/tools/publish-tax-compliance-artifact"
import sales from "@squads/sales-strategy/tools/publish-sales-strategy-artifact"
import distribution from "@squads/omnichannel-distribution/tools/publish-omnichannel-artifact"
import marketing from "@squads/marketing-growth/tools/publish-marketing-growth-artifact"
import seo from "@squads/seo-geo/tools/publish-seo-geo-artifact"

for (const [name, publisher] of Object.entries({ data, viral, legal, hr, tax, sales, distribution, marketing, seo })) {
  test(`${name} declares executable Engine predecessors and the resource-kind error contract`, () => {
    const schema = publisher.introspect().inputSchema as any
    const input = name === "data" ? schema.properties.artifact.oneOf[0] : schema
    const predecessor = input.properties.predecessor_artifact_locators
    const validate = new Ajv({ strict: false, validateFormats: false }).compile({
      $defs: schema.$defs,
      ...predecessor,
    })
    expect(input.required).toContain("predecessor_artifact_locators")
    expect(validate([])).toBe(true)
    expect(
      validate([
        { source: "engine_artifact", artifact_id: "art_exact", catalog_revision: 1, expected_sha256: "a".repeat(64) },
      ]),
    ).toBe(true)
    validate([
      {
        source: "task_artifact_resource",
        artifact_id: "art_exact",
        catalog_revision: 1,
        expected_sha256: "a".repeat(64),
      },
    ])
    expect(validate.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyword: "const",
          instancePath: "/0/source",
          params: { allowedValue: "engine_artifact" },
        }),
      ]),
    )
  })
}
