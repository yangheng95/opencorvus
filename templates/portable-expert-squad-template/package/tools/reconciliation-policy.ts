import { tool } from "@opencorvus-ai/plugin"
import policy from "../assets/reconciliation-policy.json" with { type: "text" }

const ARTIFACT_TYPE = "portable-template/reconciliation-policy"
const ARTIFACT_SCHEMA_VERSION = 1
const ARTIFACT_LABEL = "Invoice ledger reconciliation policy"

export default tool({
  description: "Publish the immutable reconciliation policy compiled into this self-contained package.",
  args: {},
  async execute(_args, context) {
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: ARTIFACT_TYPE,
      schema_version: ARTIFACT_SCHEMA_VERSION,
      label: ARTIFACT_LABEL,
      payload: JSON.parse(policy),
      resources: [],
      source_artifact_locators: [],
    })
    context.metadata({
      title: ARTIFACT_LABEL,
      metadata: { artifact_type: ARTIFACT_TYPE, artifact_sha256: publication.sha256 },
    })
    return JSON.stringify({ locator: publication.locator, sha256: publication.sha256 })
  },
})
