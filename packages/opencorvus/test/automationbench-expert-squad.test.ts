import { expect, test } from "bun:test"
import path from "node:path"
import { ExpertSquadRegistry } from "../src/expert-squad/registry"
import { materializeExpertSquadCapabilities } from "../src/expert-squad/capability-grants"
import { analyzeExpertSquadWorkflowTopology } from "../../sdk/js/src/expert-squad-authoring"

test("AutomationBench loads through the real package loader with official API capabilities", async () => {
  const root = path.resolve(import.meta.dir, "../../../expert-squads/builtin/automationbench")
  const pkg = await ExpertSquadRegistry.loadSourcePackage(root)
  expect(pkg.manifest.id).toBe("automationbench")
  expect(Object.keys(pkg.promptProfile.agents).sort()).toEqual([
    "automationbench-executor",
    "automationbench-source-reviewer",
    "automationbench-verifier",
    "orchestrator",
  ])
  for (const [id, projection] of Object.entries(pkg.manifest.capability_projection.agents)) {
    const grants = materializeExpertSquadCapabilities({
      manifest: pkg.manifest,
      projection,
      runtime: { kind: "worker", baseRole: "delegated-worker" },
      context: id,
    })
    expect(grants.defaultMcpToolRefs).toEqual([
      "default/mcp/automationbench/tool/api_fetch",
      "default/mcp/automationbench/tool/api_search",
      "default/mcp/automationbench/tool/base64_encode",
    ])
  }
  expect(analyzeExpertSquadWorkflowTopology(pkg.manifest)).toMatchObject([{
    workflow_id: "review-execute-verify",
    structure: "dependency_dag",
    waves: [
      { depth: 0, node_ids: ["automationbench-source-reviewer"] },
      { depth: 1, node_ids: ["automationbench-executor"] },
      { depth: 2, node_ids: ["automationbench-verifier"] },
    ],
  }])
})
