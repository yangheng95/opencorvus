/** Explicit operator test driver. No Task, participant Message, Provider or business world. */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"

const [stagedArgument, outputArgument, ...extra] = process.argv.slice(2)
if (!stagedArgument || !outputArgument || extra.length) {
  throw new Error("Usage: bun check-expectation-first.ts <staged-squad> <new-output-directory>")
}
const root = path.resolve(import.meta.dir, "../../..")
const staged = path.resolve(stagedArgument)
const output = path.resolve(outputArgument)
await fs.mkdir(output)
process.env.OPENCORVUS_HOME = path.join(output, "runtime")
process.env.OPENCORVUS_TEST_HOME = process.env.OPENCORVUS_HOME
process.env.OPENCORVUS_TEST_PROCESS_ROOT = output

const { ExpertSquadRegistry } = await import("../../../packages/opencorvus/src/expert-squad/registry")
const { materializeExpertSquadCapabilities } = await import("../../../packages/opencorvus/src/expert-squad/capability-grants")
const { analyzeExpertSquadWorkflowTopology } = await import("../../../packages/sdk/js/src/expert-squad-authoring")
const { dispatchWorkflowBinding } = await import("../../../packages/opencorvus/src/engine/workflow-binding")
const { buildDelegatedWorkerUserPrompt } = await import("../../../packages/opencorvus/src/delegated-worker/agent")
const { renderUserRequestSection } = await import("../../../packages/opencorvus/src/intent/request-prompt")

const baselineRoot = path.join(root, "expert-squads/builtin/automationbench")
const baseline = await ExpertSquadRegistry.loadSourcePackage(baselineRoot)
const design = await ExpertSquadRegistry.loadSourcePackage(staged)
assert.equal(baseline.version, "2026.09.25.14")
assert.equal(design.version, "2026.09.25.15")
const reloaded = await ExpertSquadRegistry.loadPackageRevisionSnapshot(design.packageDigest)
assert.deepEqual(reloaded.manifest, design.manifest)

const files = [
  "README.md", "agents/automationbench-executor/system.md", "agents/automationbench-verifier/system.md",
  "agents/orchestrator/system.md", "expert-squad.jsonc", "selector.md",
]
const changed: string[] = []
for (const file of files) {
  const draftBytes = await fs.readFile(path.join(staged, file))
  assert.deepEqual(await fs.readFile(path.join(reloaded.root, file)), draftBytes)
  if (!(await fs.readFile(path.join(baselineRoot, file))).equals(draftBytes)) changed.push(file)
}
assert.deepEqual(changed, [
  "README.md", "agents/automationbench-verifier/system.md", "agents/orchestrator/system.md", "expert-squad.jsonc",
])

const expectedWorkers = ["automationbench-executor", "automationbench-verifier"]
assert.deepEqual(Object.keys(design.manifest.capability_projection.agents).sort(), expectedWorkers)
assert.deepEqual(design.manifest.capability_projection.scheduler.capability_refs,
  baseline.manifest.capability_projection.scheduler.capability_refs)
const capabilities = expectedWorkers.map((agent) => {
  const grants = (pkg: typeof design) => materializeExpertSquadCapabilities({
    manifest: pkg.manifest,
    projection: pkg.manifest.capability_projection.agents[agent]!,
    runtime: { kind: "worker", baseRole: "delegated-worker" },
    context: agent,
  })
  assert.deepEqual(grants(design), grants(baseline))
  assert.deepEqual(grants(design).defaultMcpToolRefs, [
    "default/mcp/automationbench/tool/api_catalog", "default/mcp/automationbench/tool/api_fetch",
    "default/mcp/automationbench/tool/api_search", "default/mcp/automationbench/tool/base64_encode",
  ])
  return { agent, grants: grants(design) }
})

const topology = analyzeExpertSquadWorkflowTopology(design.manifest)
assert.equal(topology.length, 1)
assert.deepEqual(topology[0]!.waves, [
  { depth: 0, node_ids: ["automationbench-expectation"] },
  { depth: 1, node_ids: ["automationbench-executor"] },
  { depth: 2, node_ids: ["automationbench-verifier"] },
])
assert.equal(topology[0]!.structure, "dependency_dag")
const projection = {
  packageRevision: {
    scope: "built_in" as const, projectID: null, namespace: design.namespace,
    id: design.id, version: design.version, packageDigest: design.packageDigest,
  },
  virtualWorkflows: design.manifest.capability_projection.virtual_workflows,
}
const bindings = [
  ["automationbench-expectation", "automationbench-verifier"],
  ["automationbench-executor", "automationbench-executor"],
  ["automationbench-verifier", "automationbench-verifier"],
].map(([node, agent]) => {
  const result = dispatchWorkflowBinding({
    projection,
    subject: { kind: "virtual_workflow", workflow_id: "execute-verify", node_id: node! },
    targetAgentID: agent!,
  })
  assert.equal(result.workflowNodeID, node)
  assert.equal(result.binding.package_revision.package_digest, design.packageDigest)
  return { node, agent, result }
})

// These are test-driver strings passed to the production renderer, not fake persisted messages.
const request = "TEST DRIVER: inspect an existing sample record and preserve its unrelated fields."
const sourceSection = renderUserRequestSection({ heading: "## Original request", request })
const stages = ["expectation formation", "outcome verification"].map((stage) => {
  const instruction = `TEST DRIVER delegated stage: ${stage}. Apply the complete original request.`
  const rendered = buildDelegatedWorkerUserPrompt(instruction, [sourceSection])
  assert.equal(rendered.indexOf(instruction) >= 0, true)
  assert.equal(rendered.indexOf(request) >= 0, true)
  return { stage, instruction, rendered }
})
const receipt = {
  kind: "operator-local-design-contract", evidence_level: "production-loader-and-pure-contracts",
  business_assessment: "not_evaluated", provider_calls: 0,
  baseline: { version: baseline.version, digest: baseline.packageDigest },
  design: { version: design.version, digest: design.packageDigest, immutable_root: reloaded.root },
  files, changed, capabilities, topology, bindings, stages,
  limitation: "No real scheduler decision, worker Session, Artifact publication, MCP call or LLM behavior was executed.",
}
await fs.writeFile(path.join(output, "receipt.json"), JSON.stringify(receipt, null, 2), { flag: "wx" })
console.log(JSON.stringify({ status: "passed", files: files.length, changed, topology, receipt: path.join(output, "receipt.json") }))
