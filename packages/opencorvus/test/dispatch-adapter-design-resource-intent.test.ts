import { expect, test } from "bun:test"
import { DispatchAdapterContractRegistry } from "../src/agent/dispatch-adapter-contract"
import { DesignResourceEntrySchema } from "../src/frontend-design/design-resource-manifest"
import { DesignResourceIntentSchema } from "../src/protocol/design-resource-intent"

test("Frontend Design dispatch and Manifest entry preserve one protocol-owned resource intent", () => {
  const intent = DesignResourceIntentSchema.parse("design_source")
  const dispatch = DispatchAdapterContractRegistry.inputSchema("frontend_design").parse({
    mode: "greenfield_original",
    reason: "Publish one exact Frontend Design resource contract.",
    attachment_bindings: [{ attachment_url: "attachment://design-source", intent }],
  })
  const entry = DesignResourceEntrySchema.parse({
    id: "resource_design_source",
    kind: "image",
    intent,
    origin: "attachment",
    mime: "image/png",
    sha256: "a".repeat(64),
    canonical_ref: "attachment://design-source",
    size: 128,
    materializer: "task-attachment",
    created_at: 1,
  })

  expect({
    protocol: intent,
    dispatch: dispatch.attachment_bindings?.[0]?.intent,
    manifest: entry.intent,
  }).toEqual({
    protocol: "design_source",
    dispatch: "design_source",
    manifest: "design_source",
  })
})
