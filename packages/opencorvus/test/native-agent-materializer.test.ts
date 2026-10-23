import { expect, test } from "bun:test"
import { materializeNativeAgentDefinitions } from "@/agent/native-agent-materializer"
import type { Config } from "@/config/config"
import { InvalidModelReferenceError } from "@/provider/model-ref"

for (const agentID of ["coding", "compaction", "orchestrator"] as const) {
  test(`${agentID} materialization preserves a configured model path and merged options`, () => {
    const materialized = materializeNativeAgentDefinitions({
      config: {
        agent: {
          [agentID]: { model: "fixture/vendor/model-v2", options: { configured: "override" } },
        },
      } as Config.Info,
      definitions: { [agentID]: { name: agentID, options: { retained: "base" } } },
    })
    expect(materialized[agentID].model).toEqual({ providerID: "fixture", modelID: "vendor/model-v2" })
    expect(materialized[agentID].options).toEqual({ retained: "base", configured: "override" })
  })

  test(`${agentID} materialization retains the original model without a model override`, () => {
    const model = { providerID: "fixture", modelID: "original/model" }
    const materialized = materializeNativeAgentDefinitions({
      config: { agent: { [agentID]: { description: "Current configured responsibility" } } } as Config.Info,
      definitions: { [agentID]: { name: agentID, model, options: {} } },
    })
    expect(materialized[agentID].model).toEqual(model)
    expect(materialized[agentID].description).toBe("Current configured responsibility")
  })

  test(`${agentID} invalid model override returns the canonical typed parser error`, () => {
    expect(() =>
      materializeNativeAgentDefinitions({
        config: { agent: { [agentID]: { model: "missing-provider-separator" } } } as Config.Info,
        definitions: { [agentID]: { name: agentID, options: {} } },
      }),
    ).toThrow(InvalidModelReferenceError)
  })
}
